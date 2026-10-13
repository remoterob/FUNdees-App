-- ============================================================
-- MERCH — FUNdees shop (Phase 0: single product, Stripe checkout)
-- ============================================================
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent).
--
-- Orders are written server-side only (netlify/functions/create-merch-checkout.js
-- + stripe-webhook.js) using the service-role key, so there is no public
-- INSERT/UPDATE policy — RLS below only governs read access.
--
-- Reuses helpers already defined by supabase-schema.sql: is_admin()
-- (re-created below as CREATE OR REPLACE so this script is self-contained).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE auth_user_id = auth.uid() AND is_admin = true
  );
$$;

CREATE TABLE IF NOT EXISTS merch_orders (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id                 UUID REFERENCES members(id) ON DELETE SET NULL,

  full_name                 TEXT NOT NULL,
  email                     TEXT NOT NULL,
  phone                     TEXT,
  delivery_address          TEXT,

  product_name              TEXT NOT NULL DEFAULT 'FUNdees Poncho Towel',
  quantity                  INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 10),
  unit_price                NUMERIC(8,2) NOT NULL DEFAULT 55.00,
  amount                    NUMERIC(8,2),          -- actual amount charged (set by webhook)
  currency                  TEXT NOT NULL DEFAULT 'NZD',

  status                    TEXT NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','paid','cancelled','refunded')),

  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id   TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at                   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_merch_orders_status ON merch_orders(status);
CREATE INDEX IF NOT EXISTS idx_merch_orders_member ON merch_orders(member_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_merch_orders_pi ON merch_orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE merch_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS merch_orders_select_own   ON merch_orders;
DROP POLICY IF EXISTS merch_orders_select_admin ON merch_orders;

CREATE POLICY merch_orders_select_own ON merch_orders FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE auth_user_id = auth.uid()));

CREATE POLICY merch_orders_select_admin ON merch_orders FOR ALL
  USING (is_admin());
