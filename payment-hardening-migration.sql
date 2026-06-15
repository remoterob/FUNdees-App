-- ============================================================
-- PAYMENT HARDENING MIGRATION
-- Run in the Supabase SQL editor. Safe to run once.
-- ============================================================

-- ── 1. Prevent a single Stripe payment from backing more than one booking ──
-- (mirrors the UNIQUE already present on membership_payments.stripe_payment_intent_id)
-- Partial index so multiple NULLs (legacy/unpaid rows) are still allowed.
CREATE UNIQUE INDEX IF NOT EXISTS session_bookings_payment_intent_unique
  ON session_bookings (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ── 2. Atomic, capacity-safe booking write ─────────────────────────────────
-- Confirms a paid booking inside a single transaction that re-checks capacity,
-- so concurrent buyers cannot oversell a session. Returns the booking id.
-- Raises 'SESSION_FULL' if no spots remain (and the booker isn't already in).
CREATE OR REPLACE FUNCTION confirm_session_booking(
  p_session_id  UUID,
  p_member_id   UUID,
  p_amount      NUMERIC,
  p_payment_intent TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_capacity   INT;
  v_booked     INT;
  v_existing   UUID;
  v_booking_id UUID;
BEGIN
  -- Lock the session row so concurrent confirmations serialise on it.
  SELECT capacity INTO v_capacity
  FROM pool_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_capacity IS NULL THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  -- Is this member already booked? (idempotent re-confirm is fine)
  SELECT id INTO v_existing
  FROM session_bookings
  WHERE session_id = p_session_id AND member_id = p_member_id;

  IF v_existing IS NULL THEN
    SELECT COUNT(*) INTO v_booked
    FROM session_bookings
    WHERE session_id = p_session_id AND status = 'confirmed';

    IF v_booked >= v_capacity THEN
      RAISE EXCEPTION 'SESSION_FULL';
    END IF;
  END IF;

  INSERT INTO session_bookings (
    session_id, member_id, status, payment_status,
    amount_charged, stripe_payment_intent_id, paid_at
  )
  VALUES (
    p_session_id, p_member_id, 'confirmed', 'paid',
    p_amount, p_payment_intent, now()
  )
  ON CONFLICT (session_id, member_id) DO UPDATE
    SET status = 'confirmed',
        payment_status = 'paid',
        amount_charged = EXCLUDED.amount_charged,
        stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
        paid_at = EXCLUDED.paid_at
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;
