-- ============================================================
-- Rigs: optional start/end time set by the lead
-- ============================================================
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent).

ALTER TABLE rigs ADD COLUMN IF NOT EXISTS time_start TIME;
ALTER TABLE rigs ADD COLUMN IF NOT EXISTS time_end TIME;
