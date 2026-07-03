-- ============================================================
-- SPEAR & COOK — Competition module (Phase 0: schema + seed)
-- ============================================================
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent).
--
-- Design decisions (agreed):
--   • Competitors REUSE their FUNdees login — sc_competitors links 1:1
--     to members(id) per competition.
--   • REPEATED events — everything hangs off sc_competitions.
--   • Assisted auto-matching by experience (logic lives in a Netlify
--     function, Phase 2 — this file just stores the data).
--   • Catch points are computed server-side (Phase 3) and written to
--     sc_claims.points; clients never insert claims directly.
--
-- Reuses helpers already defined by supabase-schema.sql:
--   is_admin()  and  update_updated_at()
-- (re-created below as CREATE OR REPLACE so this script is self-contained).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Shared helpers (idempotent re-create) ─────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE auth_user_id = auth.uid() AND is_admin = true
  );
$$;

-- Maps the current auth user → their members.id (bypasses RLS safely).
CREATE OR REPLACE FUNCTION sc_member_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM members WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ─── ENUMS ─────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sc_experience') THEN
    CREATE TYPE sc_experience AS ENUM ('Beginner', 'Intermediate', 'Experienced');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sc_competition_status') THEN
    CREATE TYPE sc_competition_status AS ENUM ('draft', 'active', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sc_cooking_category') THEN
    CREATE TYPE sc_cooking_category AS ENUM ('cooked', 'raw', 'whole');
  END IF;
END $$;

-- ─── COMPETITIONS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sc_competitions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  description    TEXT,
  date_start     DATE,
  date_end       DATE,
  status         sc_competition_status NOT NULL DEFAULT 'draft',
  spearing_open  BOOLEAN NOT NULL DEFAULT false,   -- catch logging open?
  judging_open   BOOLEAN NOT NULL DEFAULT false,   -- cook judging open?
  entry_fee      NUMERIC(8,2) NOT NULL DEFAULT 0,
  rules_text     TEXT,
  rules_version  TEXT,
  created_by     UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS sc_competitions_updated_at ON sc_competitions;
CREATE TRIGGER sc_competitions_updated_at
  BEFORE UPDATE ON sc_competitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── COMPETITORS (1:1 with a member, per competition) ──────

CREATE TABLE IF NOT EXISTS sc_competitors (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id     UUID NOT NULL REFERENCES sc_competitions(id) ON DELETE CASCADE,
  member_id          UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  experience         sc_experience,
  preferred_partner  TEXT,
  age_group          TEXT,
  gender             TEXT,
  club               TEXT,

  -- Safety (competition requirement)
  safety_contact     TEXT,
  safety_phone       TEXT,
  medical_info       TEXT,
  boat_capacity_note TEXT,

  -- Entry payment (set server-side by the Stripe webhook — Phase 1)
  paid               BOOLEAN NOT NULL DEFAULT false,
  payment_ref        TEXT,
  stripe_payment_intent_id TEXT,

  -- Rules acceptance snapshot
  rules_accepted_at   TIMESTAMPTZ,
  rules_accepted_name TEXT,
  rules_version       TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competition_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_sc_competitors_comp   ON sc_competitors(competition_id);
CREATE INDEX IF NOT EXISTS idx_sc_competitors_member ON sc_competitors(member_id);

-- ─── TEAMS + MEMBERSHIP ────────────────────────────────────

CREATE TABLE IF NOT EXISTS sc_teams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id  UUID NOT NULL REFERENCES sc_competitions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  boat            TEXT,
  skipper_contact TEXT,
  created_by      UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sc_teams_comp ON sc_teams(competition_id);

CREATE TABLE IF NOT EXISTS sc_team_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id       UUID NOT NULL REFERENCES sc_teams(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES sc_competitors(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, competitor_id),
  UNIQUE (competitor_id)   -- a competitor belongs to at most one team
);
CREATE INDEX IF NOT EXISTS idx_sc_team_members_team ON sc_team_members(team_id);

-- ─── SPECIES (global reusable library) ─────────────────────

CREATE TABLE IF NOT EXISTS sc_species (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  base_points INTEGER NOT NULL DEFAULT 100,
  tip         TEXT,
  image_path  TEXT,
  active      BOOLEAN NOT NULL DEFAULT true
);

-- ─── CLAIMS (a logged catch — points written server-side) ──

CREATE TABLE IF NOT EXISTS sc_claims (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES sc_competitions(id) ON DELETE CASCADE,
  team_id        UUID REFERENCES sc_teams(id) ON DELETE SET NULL,
  competitor_id  UUID REFERENCES sc_competitors(id) ON DELETE SET NULL,
  species_slug   TEXT REFERENCES sc_species(slug),
  species        TEXT NOT NULL,           -- denormalised name at time of catch
  weight_g       INTEGER NOT NULL,
  length_mm      INTEGER,
  photo_url      TEXT,
  points         INTEGER NOT NULL DEFAULT 0,
  verified       BOOLEAN NOT NULL DEFAULT false,
  deleted        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sc_claims_comp ON sc_claims(competition_id);
CREATE INDEX IF NOT EXISTS idx_sc_claims_team ON sc_claims(team_id);

-- ─── COOKING ENTRIES + VOTES ───────────────────────────────

CREATE TABLE IF NOT EXISTS sc_cooking_entries (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES sc_competitions(id) ON DELETE CASCADE,
  team_id        UUID NOT NULL REFERENCES sc_teams(id) ON DELETE CASCADE,
  category       sc_cooking_category NOT NULL,
  title          TEXT,
  image_url      TEXT,
  submitted_by   UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sc_cooking_entries_comp ON sc_cooking_entries(competition_id);

CREATE TABLE IF NOT EXISTS sc_cooking_votes (
  entry_id     UUID NOT NULL REFERENCES sc_cooking_entries(id) ON DELETE CASCADE,
  voter_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  presentation SMALLINT,
  flavour      SMALLINT,
  creativity   SMALLINT,
  wow          SMALLINT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, voter_id)
);

-- ─── VIEWS (safe, read-only projections for the UI) ────────
-- security_invoker = false → runs as owner, bypassing RLS, so we
-- expose ONLY non-sensitive columns (no medical/safety/contact).

CREATE OR REPLACE VIEW sc_roster
WITH (security_invoker = false) AS
SELECT c.id            AS competitor_id,
       c.competition_id,
       c.member_id,
       m.full_name,
       c.experience,
       c.club,
       c.paid,
       tm.team_id,
       t.name          AS team_name
FROM sc_competitors c
JOIN members m         ON m.id = c.member_id
LEFT JOIN sc_team_members tm ON tm.competitor_id = c.id
LEFT JOIN sc_teams t    ON t.id = tm.team_id;

GRANT SELECT ON sc_roster TO authenticated;

CREATE OR REPLACE VIEW sc_team_catch_totals
WITH (security_invoker = false) AS
SELECT t.id            AS team_id,
       t.competition_id,
       t.name,
       COALESCE(SUM(cl.points) FILTER (WHERE NOT cl.deleted), 0) AS catch_points,
       COUNT(cl.id)             FILTER (WHERE NOT cl.deleted)     AS catch_count
FROM sc_teams t
LEFT JOIN sc_claims cl ON cl.team_id = t.id
GROUP BY t.id;

GRANT SELECT ON sc_team_catch_totals TO authenticated;

-- ─── ROW LEVEL SECURITY ────────────────────────────────────
-- Reads: authenticated club members can see comps, species, teams,
-- rosters and (non-deleted) claims for the leaderboard.
-- Writes: admins only from the client; sensitive writes (claims
-- scoring, team assignment, payment) go through Netlify functions
-- using the service-role key, which bypasses RLS.

ALTER TABLE sc_competitions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_competitors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_team_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_species         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_claims          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_cooking_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_cooking_votes   ENABLE ROW LEVEL SECURITY;

-- competitions: everyone authenticated reads; admins write
DROP POLICY IF EXISTS sc_comp_read  ON sc_competitions;
DROP POLICY IF EXISTS sc_comp_admin ON sc_competitions;
CREATE POLICY sc_comp_read  ON sc_competitions FOR SELECT TO authenticated USING (true);
CREATE POLICY sc_comp_admin ON sc_competitions FOR ALL    USING (is_admin());

-- species: everyone authenticated reads; admins write
DROP POLICY IF EXISTS sc_species_read  ON sc_species;
DROP POLICY IF EXISTS sc_species_admin ON sc_species;
CREATE POLICY sc_species_read  ON sc_species FOR SELECT TO authenticated USING (true);
CREATE POLICY sc_species_admin ON sc_species FOR ALL    USING (is_admin());

-- competitors: read own row; admins read/write all (client registration
-- and paid-flag updates are routed through functions in Phase 1)
DROP POLICY IF EXISTS sc_competitors_own   ON sc_competitors;
DROP POLICY IF EXISTS sc_competitors_admin ON sc_competitors;
CREATE POLICY sc_competitors_own   ON sc_competitors FOR SELECT
  USING (member_id = sc_member_id());
CREATE POLICY sc_competitors_admin ON sc_competitors FOR ALL
  USING (is_admin());

-- teams + membership: authenticated read (leaderboard/your team); admin write
DROP POLICY IF EXISTS sc_teams_read  ON sc_teams;
DROP POLICY IF EXISTS sc_teams_admin ON sc_teams;
CREATE POLICY sc_teams_read  ON sc_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY sc_teams_admin ON sc_teams FOR ALL    USING (is_admin());

DROP POLICY IF EXISTS sc_team_members_read  ON sc_team_members;
DROP POLICY IF EXISTS sc_team_members_admin ON sc_team_members;
CREATE POLICY sc_team_members_read  ON sc_team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY sc_team_members_admin ON sc_team_members FOR ALL    USING (is_admin());

-- claims: authenticated read of non-deleted (for the leaderboard); admin write.
-- Competitor catch logging happens via a function (service role), so no
-- client INSERT policy — this keeps point calculation tamper-proof.
DROP POLICY IF EXISTS sc_claims_read  ON sc_claims;
DROP POLICY IF EXISTS sc_claims_admin ON sc_claims;
CREATE POLICY sc_claims_read  ON sc_claims FOR SELECT TO authenticated USING (NOT deleted);
CREATE POLICY sc_claims_admin ON sc_claims FOR ALL    USING (is_admin());

-- cooking entries: authenticated read; admin write (team submission via
-- function in Phase 4)
DROP POLICY IF EXISTS sc_cook_entries_read  ON sc_cooking_entries;
DROP POLICY IF EXISTS sc_cook_entries_admin ON sc_cooking_entries;
CREATE POLICY sc_cook_entries_read  ON sc_cooking_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY sc_cook_entries_admin ON sc_cooking_entries FOR ALL    USING (is_admin());

-- cooking votes: a judge sees/sets only their own vote; admins see all
DROP POLICY IF EXISTS sc_cook_votes_own       ON sc_cooking_votes;
DROP POLICY IF EXISTS sc_cook_votes_own_write ON sc_cooking_votes;
DROP POLICY IF EXISTS sc_cook_votes_admin     ON sc_cooking_votes;
CREATE POLICY sc_cook_votes_own       ON sc_cooking_votes FOR SELECT
  USING (voter_id = sc_member_id());
CREATE POLICY sc_cook_votes_own_write ON sc_cooking_votes FOR ALL
  USING (voter_id = sc_member_id())
  WITH CHECK (voter_id = sc_member_id());
CREATE POLICY sc_cook_votes_admin     ON sc_cooking_votes FOR ALL
  USING (is_admin());

-- ─── SEED: species library (deduped + normalised from 2026 backup) ──

INSERT INTO sc_species (slug, name, base_points, tip) VALUES
  ('blue-cod',       'Blue Cod',       100, NULL),
  ('blue-mao-mao',   'Blue Mao Mao',   100, NULL),
  ('blue-moki',      'Blue Moki',      100, NULL),
  ('butterfish',     'Butterfish',     100, NULL),
  ('giant-boarfish', 'Giant Boarfish', 100, NULL),
  ('gurnard',        'Gurnard',        100, NULL),
  ('john-dory',      'John Dory',      100, NULL),
  ('kahawai',        'Kahawai',        100, NULL),
  ('kingfish',       'Kingfish',       100, NULL),
  ('koheru',         'Koheru',         100, NULL),
  ('leather-jacket', 'Leather Jacket', 100, NULL),
  ('octopus',        'Octopus',        100, 'Lurking in caves, cracks or munching in a scallop bed. Careful how you grab them — sometimes it is hard to know who has who...'),
  ('parore',         'Parore',         100, NULL),
  ('pigfish',        'Pigfish',        100, NULL),
  ('porae',          'Porae',          100, NULL),
  ('red-mullet',     'Red Mullet',     100, NULL),
  ('snapper',        'Snapper',        100, NULL),
  ('squid',          'Squid',          100, NULL),
  ('trevally',       'Trevally',       100, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ─── SEED: a starter competition (draft — activate it in Admin) ────

INSERT INTO sc_competitions (name, description, status, entry_fee)
SELECT 'Spear & Cook 2026', 'Paired spearfishing & cook-off competition.', 'draft', 0
WHERE NOT EXISTS (SELECT 1 FROM sc_competitions);

-- ============================================================
-- End Phase 0. Next: Phase 1 (registration + rules + entry payment).
-- ============================================================
