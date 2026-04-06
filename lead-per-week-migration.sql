-- Move lead from sessions table to session_plans (per-week lead)
ALTER TABLE session_plans ADD COLUMN IF NOT EXISTS lead_member_id UUID REFERENCES members(id) ON DELETE SET NULL;

-- Migrate existing lead from sessions → session_plans where possible
UPDATE session_plans sp
SET lead_member_id = s.lead_member_id
FROM sessions s
WHERE sp.session_id = s.id
  AND s.lead_member_id IS NOT NULL
  AND sp.lead_member_id IS NULL;
