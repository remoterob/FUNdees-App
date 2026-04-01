-- ============================================================
-- SPEARFISHING FUNDAMENTALS — Supabase Schema
-- ============================================================
-- Stack: Supabase (PostgreSQL + Auth + Row Level Security)
-- Payments: Stripe (webhook updates payment records here)
-- Hosting: Netlify
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUMS ─────────────────────────────────────────────────

CREATE TYPE membership_tier AS ENUM ('annual', 'student', 'casual');
CREATE TYPE membership_status AS ENUM ('active', 'expired', 'cancelled', 'pending');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'waitlist');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'failed');
CREATE TYPE session_status AS ENUM ('upcoming', 'completed', 'cancelled');

-- ─── MEMBERS ───────────────────────────────────────────────

CREATE TABLE members (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal info
  full_name         TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  phone             TEXT,
  date_of_birth     DATE,
  emergency_contact TEXT,          -- "Name: +64 21 xxx" free text for now

  -- Membership
  tier              membership_tier NOT NULL DEFAULT 'casual',
  status            membership_status NOT NULL DEFAULT 'pending',
  membership_start  DATE,
  membership_end    DATE,
  
  -- Club roles
  is_admin          BOOLEAN NOT NULL DEFAULT false,
  is_qualified_lead BOOLEAN NOT NULL DEFAULT false,  -- can lead pool sessions
  qualifications    TEXT[],  -- e.g. ['AIDA2', 'PADI Freediver', 'First Aid']

  -- Stripe
  stripe_customer_id TEXT UNIQUE,

  -- Metadata
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── POOL SESSIONS ─────────────────────────────────────────

CREATE TABLE pool_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  title             TEXT NOT NULL,
  description       TEXT,
  session_plan      TEXT,          -- markdown/text of what will be covered
  
  session_date      DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  location          TEXT NOT NULL DEFAULT 'WaterWorld Auckland 50m Pool',
  
  capacity          INT NOT NULL DEFAULT 12,
  
  -- Lead assignment (resolved FK after members table)
  lead_member_id    UUID REFERENCES members(id) ON DELETE SET NULL,
  
  -- Pricing
  member_price      NUMERIC(8,2) NOT NULL DEFAULT 10.00,
  casual_price      NUMERIC(8,2) NOT NULL DEFAULT 15.00,
  
  status            session_status NOT NULL DEFAULT 'upcoming',
  
  -- Block grouping (e.g. "Block 2 — April 2025")
  block_name        TEXT,
  block_number      INT,

  -- Metadata
  created_by        UUID REFERENCES members(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── SESSION BOOKINGS ──────────────────────────────────────

CREATE TABLE session_bookings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  session_id        UUID NOT NULL REFERENCES pool_sessions(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  
  status            booking_status NOT NULL DEFAULT 'confirmed',
  
  -- Payment
  payment_status    payment_status NOT NULL DEFAULT 'pending',
  amount_charged    NUMERIC(8,2),
  stripe_payment_intent_id TEXT,
  paid_at           TIMESTAMPTZ,
  
  -- Metadata
  booked_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at      TIMESTAMPTZ,
  
  UNIQUE(session_id, member_id)
);

-- ─── MEMBERSHIP PAYMENTS ───────────────────────────────────

CREATE TABLE membership_payments (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  member_id               UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  
  amount                  NUMERIC(8,2) NOT NULL,
  currency                TEXT NOT NULL DEFAULT 'NZD',
  tier                    membership_tier NOT NULL,
  
  payment_status          payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_invoice_id       TEXT,
  
  period_start            DATE,
  period_end              DATE,
  
  paid_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── SESSION LEAD ROSTER (future feature) ──────────────────
-- Tracks who is rostered to lead each session and swap history

CREATE TABLE session_lead_roster (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  session_id        UUID NOT NULL REFERENCES pool_sessions(id) ON DELETE CASCADE,
  lead_member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  
  is_confirmed      BOOLEAN NOT NULL DEFAULT false,
  notified_at       TIMESTAMPTZ,
  
  -- Swap tracking
  swapped_from_member_id UUID REFERENCES members(id),
  swapped_at        TIMESTAMPTZ,
  swap_reason       TEXT,
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(session_id)   -- one lead per session
);

-- ─── NOTIFICATIONS LOG (future feature) ────────────────────

CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,   -- 'lead_assigned', 'booking_confirmed', 'session_reminder', etc.
  subject       TEXT,
  body          TEXT,
  sent_at       TIMESTAMPTZ,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── UPDATED_AT TRIGGER ────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pool_sessions_updated_at
  BEFORE UPDATE ON pool_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── VIEWS ─────────────────────────────────────────────────

-- Session with live booking count and spots remaining
CREATE VIEW sessions_with_availability AS
SELECT
  s.*,
  COUNT(b.id) FILTER (WHERE b.status = 'confirmed') AS booked_count,
  s.capacity - COUNT(b.id) FILTER (WHERE b.status = 'confirmed') AS spots_remaining,
  m.full_name AS lead_name
FROM pool_sessions s
LEFT JOIN session_bookings b ON b.session_id = s.id
LEFT JOIN members m ON m.id = s.lead_member_id
GROUP BY s.id, m.full_name;

-- Member dashboard summary
CREATE VIEW member_dashboard AS
SELECT
  m.id,
  m.full_name,
  m.email,
  m.tier,
  m.status,
  m.membership_end,
  COUNT(b.id) FILTER (WHERE b.status = 'confirmed') AS total_bookings,
  COUNT(b.id) FILTER (
    WHERE b.status = 'confirmed'
    AND (SELECT session_date FROM pool_sessions WHERE id = b.session_id) >= CURRENT_DATE
  ) AS upcoming_bookings
FROM members m
LEFT JOIN session_bookings b ON b.member_id = m.id
GROUP BY m.id;

-- ─── ROW LEVEL SECURITY ────────────────────────────────────

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_payments ENABLE ROW LEVEL SECURITY;

-- Helper function: avoids recursive RLS by using SECURITY DEFINER
-- (bypasses RLS when checking admin status)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE auth_user_id = auth.uid()
    AND is_admin = true
  );
$$;

-- Members: own row via direct auth.uid() check (no subquery = no recursion)
CREATE POLICY "members_select_own"
  ON members FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "members_select_admin"
  ON members FOR SELECT
  USING (is_admin());

CREATE POLICY "members_update_own"
  ON members FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- Pool sessions: all authenticated users can view, only admins can mutate
CREATE POLICY "sessions_select_authenticated"
  ON pool_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "sessions_admin_write"
  ON pool_sessions FOR ALL
  USING (is_admin());

-- Bookings: use EXISTS with join instead of IN subquery (avoids recursion)
CREATE POLICY "bookings_select_own"
  ON session_bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = session_bookings.member_id
      AND m.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "bookings_insert_own"
  ON session_bookings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = session_bookings.member_id
      AND m.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "bookings_admin"
  ON session_bookings FOR ALL
  USING (is_admin());

-- Payments: members see own only
CREATE POLICY "payments_select_own"
  ON membership_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = membership_payments.member_id
      AND m.auth_user_id = auth.uid()
    )
  );

-- ─── SEED DATA (example) ───────────────────────────────────

INSERT INTO pool_sessions (title, description, session_plan, session_date, start_time, end_time, block_name, block_number, member_price, casual_price)
VALUES
  (
    'Static Apnea Fundamentals',
    'Focus on diaphragmatic breathing, relaxation and CO₂ tolerance tables.',
    '# Session Plan\n\n## Warm-up (15 min)\n- Land stretching\n- Breathing exercises\n\n## Pool Work (90 min)\n- Static holds: 3x2min with 2min recovery\n- CO₂ tables: 8x30s breath-hold, 2min rest\n- Buddy observation practice\n\n## Debrief (15 min)',
    '2025-04-09', '18:30', '20:30',
    'Block 2 — April 2025', 2, 10.00, 15.00
  ),
  (
    'Dynamic Apnea & Turns',
    'Lane swimming with fins, flip turns at depth, and kick technique.',
    '# Session Plan\n\n## Warm-up (15 min)\n- Fin swimming warm-up\n\n## Pool Work (90 min)\n- 25m dynamic with bifins\n- 50m dynamic attempts\n- Flip turns at 2m depth\n- Streamline position drill\n\n## Debrief (15 min)',
    '2025-04-16', '18:30', '20:30',
    'Block 2 — April 2025', 2, 10.00, 15.00
  ),
  (
    'Rescue & Buddy Protocols',
    'Blackout recognition, rescue techniques, and buddy safety drills.',
    '# Session Plan\n\n## Theory (20 min)\n- LMC vs Blackout recognition\n- Rescue sequence\n\n## Pool Work (85 min)\n- Practice surface tows\n- Rescue breathing on surface\n- Buddy safety distance drills\n\n## Assessment (15 min)',
    '2025-04-23', '18:30', '20:30',
    'Block 2 — April 2025', 2, 10.00, 15.00
  );
