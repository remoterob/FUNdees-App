-- ============================================================
-- DEPTH SESSIONS — weekday recurrence + leads running rigs
-- ============================================================
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent).
--
-- Design:
--   • A depth `sessions` row is a series (date_start/date_end + the
--     weekdays it runs on); admin.html generates one `depth_occurrences`
--     row per matching weekday in that range.
--   • Enrolment/payment stays exactly as-is (sessions.price, enrolments,
--     create-enrolment-checkout.js, sessions_with_counts) — one fee for
--     the whole series, no separate rig fee.
--   • On a given occurrence, a qualified lead can open one `rigs` row
--     (a dive plan + capacity 1-4). Enrolled+paid members join via
--     `rig_members`, with a waitlist and auto-promotion on a drop-out.
--   • Self-service writes (create/join/leave a rig) go through
--     netlify/functions/depth-rig-action.js using the service-role key,
--     matching the enrolments/sc_* convention — no client insert
--     policies on these tables beyond admin.
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

-- ─── sessions: weekday config for depth series ─────────────
-- 0-6 = Sun-Sat (matches JS Date.getDay()). NULL/unused for type='pool'.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS weekdays SMALLINT[];

-- ─── DEPTH OCCURRENCES (one generated dated instance) ──────

CREATE TABLE IF NOT EXISTS depth_occurrences (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled' | 'cancelled'
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, occurrence_date)
);
CREATE INDEX IF NOT EXISTS idx_depth_occurrences_session ON depth_occurrences(session_id);

DROP TRIGGER IF EXISTS depth_occurrences_updated_at ON depth_occurrences;
CREATE TRIGGER depth_occurrences_updated_at
  BEFORE UPDATE ON depth_occurrences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RIGS (one lead's dive plan on one occurrence) ─────────

CREATE TABLE IF NOT EXISTS rigs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  occurrence_id  UUID NOT NULL REFERENCES depth_occurrences(id) ON DELETE CASCADE,
  lead_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  description    TEXT,
  capacity       SMALLINT NOT NULL DEFAULT 4 CHECK (capacity BETWEEN 1 AND 4),
  status         TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'cancelled'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (occurrence_id, lead_member_id)
);
CREATE INDEX IF NOT EXISTS idx_rigs_occurrence ON rigs(occurrence_id);

DROP TRIGGER IF EXISTS rigs_updated_at ON rigs;
CREATE TRIGGER rigs_updated_at
  BEFORE UPDATE ON rigs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RIG MEMBERS (confirmed or waitlisted divers on a rig) ─

CREATE TABLE IF NOT EXISTS rig_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rig_id     UUID NOT NULL REFERENCES rigs(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'confirmed',  -- 'confirmed' | 'waitlisted'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rig_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_rig_members_rig ON rig_members(rig_id);
CREATE INDEX IF NOT EXISTS idx_rig_members_member ON rig_members(member_id);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────
-- Reads: any authenticated member can see occurrences/rigs/rosters
-- (needed to browse and pick a rig). Writes: admins only from the
-- client; lead/member self-service writes go through
-- depth-rig-action.js using the service-role key.

ALTER TABLE depth_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE rigs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rig_members       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS depth_occurrences_read  ON depth_occurrences;
DROP POLICY IF EXISTS depth_occurrences_admin ON depth_occurrences;
CREATE POLICY depth_occurrences_read  ON depth_occurrences FOR SELECT TO authenticated USING (true);
CREATE POLICY depth_occurrences_admin ON depth_occurrences FOR ALL    USING (is_admin());

DROP POLICY IF EXISTS rigs_read  ON rigs;
DROP POLICY IF EXISTS rigs_admin ON rigs;
CREATE POLICY rigs_read  ON rigs FOR SELECT TO authenticated USING (true);
CREATE POLICY rigs_admin ON rigs FOR ALL    USING (is_admin());

DROP POLICY IF EXISTS rig_members_read  ON rig_members;
DROP POLICY IF EXISTS rig_members_admin ON rig_members;
CREATE POLICY rig_members_read  ON rig_members FOR SELECT TO authenticated USING (true);
CREATE POLICY rig_members_admin ON rig_members FOR ALL    USING (is_admin());

-- ============================================================
-- End. Backend: netlify/functions/depth-rig-action.js
-- Admin UI: admin.html (weekday picker + occurrence/rig management)
-- Member UI: index.html "My Sessions" (open/join/leave a rig)
-- ============================================================
