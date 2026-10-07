-- ============================================================
-- SPEAR & COOK — Team photo
-- ============================================================
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent).
--
-- Lets a team member (or admin) attach one photo to their team, shown
-- wherever the team appears — the Competitor tab's "Your Team" card, the
-- Catch/Cook tabs, Judge groupings, the Scores leaderboards and Admin.
--
-- Writes go through netlify/functions/sc-team-photo.js (service role),
-- same pattern as `paid` — no new client write policy on sc_teams needed.

ALTER TABLE sc_teams ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Recreate the catch-leaderboard view so it carries the photo through.
-- CREATE OR REPLACE VIEW only allows appending columns at the end — the
-- original column order (team_id, competition_id, name, catch_points,
-- catch_count) must stay exactly as-is, so photo_url goes last.
CREATE OR REPLACE VIEW sc_team_catch_totals
WITH (security_invoker = false) AS
SELECT t.id            AS team_id,
       t.competition_id,
       t.name,
       COALESCE(SUM(cl.points) FILTER (WHERE NOT cl.deleted), 0) AS catch_points,
       COUNT(cl.id)             FILTER (WHERE NOT cl.deleted)     AS catch_count,
       t.photo_url
FROM sc_teams t
LEFT JOIN sc_claims cl ON cl.team_id = t.id
GROUP BY t.id;

GRANT SELECT ON sc_team_catch_totals TO authenticated;

-- ============================================================
