-- ============================================================
-- SPEAR & COOK — Phase 4: cook-off judging + anti-gaming reveal
-- ============================================================
-- Run once in Supabase → SQL Editor. Safe to re-run.

-- Reveal flag: while FALSE, aggregate cook scores are hidden from
-- everyone except admins (enforced by the sc-cook-results function).
ALTER TABLE sc_competitions
  ADD COLUMN IF NOT EXISTS cook_results_visible BOOLEAN NOT NULL DEFAULT false;

-- One dish per category per team.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sc_cooking_entries_team_cat_uq') THEN
    ALTER TABLE sc_cooking_entries ADD CONSTRAINT sc_cooking_entries_team_cat_uq UNIQUE (team_id, category);
  END IF;
END $$;

-- Anti-gaming: remove the client write policy on votes. Votes are now
-- cast ONLY through the sc-cook-vote function (service role), which
-- enforces "can't judge your own team" and "judging must be open".
-- Judges can still SELECT their own vote; nobody can read others' votes
-- or aggregates directly — the only way to see totals is the
-- sc-cook-results function, which honours cook_results_visible.
DROP POLICY IF EXISTS sc_cook_votes_own_write ON sc_cooking_votes;

-- ============================================================
