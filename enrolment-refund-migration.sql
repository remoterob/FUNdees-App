-- Enrolment status management + Stripe refunds
-- Run in the Supabase SQL editor.

-- New terminal status for refunded enrolments
ALTER TYPE enrolment_status ADD VALUE IF NOT EXISTS 'refunded';

-- Track the Stripe refund on the enrolment row
ALTER TABLE enrolments ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;
ALTER TABLE enrolments ADD COLUMN IF NOT EXISTS refunded_at      TIMESTAMPTZ;
