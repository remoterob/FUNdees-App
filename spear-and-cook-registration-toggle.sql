-- ============================================================
-- SPEAR & COOK — registration open/close toggle
-- ============================================================
-- Run in Supabase → SQL Editor. Safe to re-run.
--
-- Adds a flag controlling whether NEW competitors can register.
-- Defaults to FALSE (closed) so registration stays shut until you
-- turn it on in Admin → Competition Controls. Anyone already
-- registered can still edit their details while it's closed.

ALTER TABLE sc_competitions
  ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT false;
