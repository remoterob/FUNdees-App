-- ── Chatbot Query Log Migration ─────────────────────────────────────────
-- Run in Fundees Supabase SQL Editor
-- Logs every question asked to Coach FUNdee for admin analytics

CREATE TABLE IF NOT EXISTS chatbot_queries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID REFERENCES members(id) ON DELETE SET NULL,
  plan_id       UUID REFERENCES session_plans(id) ON DELETE SET NULL,
  session_title TEXT,
  week_num      INTEGER,
  question      TEXT NOT NULL,
  response_ok   BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_queries_created ON chatbot_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_queries_member  ON chatbot_queries(member_id);

ALTER TABLE chatbot_queries ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can insert (so the Netlify function using anon key can log)
CREATE POLICY "chatbot_queries_insert_authenticated" ON chatbot_queries
  FOR INSERT TO authenticated, anon WITH CHECK (true);

-- Only admins can read
CREATE POLICY "chatbot_queries_read_admin" ON chatbot_queries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.is_admin = true
    )
  );
