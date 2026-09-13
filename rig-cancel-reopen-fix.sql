-- ============================================================
-- Fix: a lead can't reopen a rig on a date after cancelling one there
-- ============================================================
-- rigs had a plain UNIQUE(occurrence_id, lead_member_id) constraint, so
-- once a lead cancelled their rig on a date, the row stuck around
-- (status='cancelled') and its unique key blocked ANY new rig by that
-- same lead on the same date — even though cancelled rigs are hidden
-- from the UI, making it look like "Create Rig" silently did nothing.
-- Replace with a partial unique index that only applies to non-cancelled
-- rigs, so a lead can freely open a fresh rig after cancelling.
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent).

ALTER TABLE rigs DROP CONSTRAINT IF EXISTS rigs_occurrence_id_lead_member_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS rigs_occurrence_lead_active_key
  ON rigs (occurrence_id, lead_member_id)
  WHERE status != 'cancelled';
