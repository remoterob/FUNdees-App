-- ============================================================
-- Sign-up documents: a PDF an admin attaches to a session, which
-- members must read and sign (typed name + date) before enrolling.
-- Anyone already enrolled is asked when they next open the app.
-- ============================================================
-- Safe to re-run. Run this BEFORE deploying the matching code: the
-- daily backup and admin session save both depend on it.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS signup_doc_path TEXT,  -- path in the Fundees bucket, e.g. SignupDocs/1730000000-guideline.pdf
  ADD COLUMN IF NOT EXISTS signup_doc_name TEXT;  -- display name shown to members

-- Postgres freezes a view's column list at CREATE time, so "s.*" won't pick
-- up the new columns on its own. sessions.html, admin.html and the checkout
-- function all read through this view. See sessions-view-weekdays-fix.sql for
-- why this is DROP + CREATE rather than CREATE OR REPLACE.
DROP VIEW IF EXISTS sessions_with_counts;

CREATE VIEW sessions_with_counts AS
SELECT
  s.*,
  COUNT(e.id) FILTER (WHERE e.status = 'enrolled') AS enrolled_count,
  s.capacity - COUNT(e.id) FILTER (WHERE e.status = 'enrolled') AS spots_remaining
FROM sessions s
LEFT JOIN enrolments e ON e.session_id = s.id
GROUP BY s.id;

-- One row per member, per session, per version of the document. An uploaded
-- document always gets a new path, so replacing it means everyone signs again.
-- The session title and document details are copied onto the row, and the
-- foreign keys are SET NULL, so the record of what was signed survives the
-- session or member being deleted later.
CREATE TABLE IF NOT EXISTS session_doc_signatures (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id     UUID REFERENCES sessions(id) ON DELETE SET NULL,
  member_id      UUID REFERENCES members(id)  ON DELETE SET NULL,
  session_title  TEXT NOT NULL,
  doc_path       TEXT NOT NULL,
  doc_name       TEXT NOT NULL,
  signed_name    TEXT NOT NULL,            -- as typed by the member
  signed_date    DATE NOT NULL,            -- as entered by the member
  signed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),  -- server time of signing
  UNIQUE (session_id, member_id, doc_path)
);

CREATE INDEX IF NOT EXISTS session_doc_signatures_member_idx
  ON session_doc_signatures (member_id);

-- Read-only from the browser. Signatures are written by the sign-session-doc
-- Netlify function (service role), and nobody can edit or delete one.
ALTER TABLE session_doc_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_signatures_read_own" ON session_doc_signatures;
CREATE POLICY "doc_signatures_read_own" ON session_doc_signatures FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "doc_signatures_read_admin" ON session_doc_signatures;
CREATE POLICY "doc_signatures_read_admin" ON session_doc_signatures FOR SELECT
  USING (is_admin());
