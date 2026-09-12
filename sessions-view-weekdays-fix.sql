-- ============================================================
-- Fix: sessions_with_counts view doesn't expose sessions.weekdays
-- ============================================================
-- Postgres freezes a view's column list at CREATE time — "s.*" in
-- sessions_with_counts was expanded before depth-rigs-migration.sql
-- added sessions.weekdays, so the view never returned it. admin.html
-- reads sessions through this view, so saved weekdays appeared to
-- vanish on reopen even though the underlying column saved fine.
-- Safe to re-run.

-- CREATE OR REPLACE can't be used here: the new column lands in the middle
-- of "s.*" (Postgres appends table columns at the end, ahead of the
-- aggregate columns), which shifts enrolled_count/spots_remaining and
-- Postgres refuses to rename existing view output columns. Drop + recreate
-- instead — default privileges on the public schema re-grant access
-- automatically (confirmed: authenticated/anon/service_role/postgres all
-- had only the standard default-privilege grants, nothing custom to redo).
DROP VIEW IF EXISTS sessions_with_counts;

CREATE VIEW sessions_with_counts AS
SELECT
  s.*,
  COUNT(e.id) FILTER (WHERE e.status = 'enrolled') AS enrolled_count,
  s.capacity - COUNT(e.id) FILTER (WHERE e.status = 'enrolled') AS spots_remaining
FROM sessions s
LEFT JOIN enrolments e ON e.session_id = s.id
GROUP BY s.id;
