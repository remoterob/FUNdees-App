-- ─── SESSION PLAN BUILDER — Migration ──────────────────────────────────────
-- Run this in Supabase SQL Editor

-- 1. Add is_lead role to members (is_qualified_lead already exists, we reuse it)
--    No new column needed — is_qualified_lead = can lead sessions = can build plans

-- 2. Drill library
CREATE TABLE IF NOT EXISTS drills (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,  -- 'Fitness & CO2', 'Distance & Depth', 'Skills & Safety', 'Relaxation'
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drills_read_all"   ON drills FOR SELECT USING (true);
CREATE POLICY "drills_lead_write" ON drills FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND (is_admin = true OR is_qualified_lead = true)));
CREATE POLICY "drills_admin_all"  ON drills FOR ALL USING (is_admin());

-- Seed the drill library from the PDF
INSERT INTO drills (id, name, category, description) VALUES
  (1,  'Unders & Overs',              'Fitness & CO2',      'Swim a distance underwater then swim on the surface back to recover.'),
  (2,  'Timeboxed Count',             'Fitness & CO2',      'Fixed period of time — do as many lengths as possible.'),
  (3,  'CO2 Tables',                  'Fitness & CO2',      'Fixed distance with reducing or increasing recovery times in table form.'),
  (4,  'Pace Variant',                'Fitness & CO2',      'Same fixed recovery time, vary the pace. Leave every minute on the minute.'),
  (5,  'Surface 3,6,9',               'Fitness & CO2',      'Freestyle 50m breathing every X strokes, cycling through front/side/back strokes.'),
  (6,  'Mid Delays',                  'Fitness & CO2',      'Swim a distance, pause midway for a submerged static, then swim back.'),
  (7,  'Start Delays',                'Fitness & CO2',      'Submerged static for a defined period then swim a defined distance.'),
  (8,  'Tile Count / Lobster Crawls', 'Fitness & CO2',      'Bottom of pool crawl/swim counting tiles or covering a distance.'),
  (9,  'Midlength Swims',             'Distance & Depth',   'Mid-length swims starting to feel hypoxia. Long recovery, buddy watches.'),
  (10, 'Rescues',                     'Skills & Safety',    'Rescue practice — Surface, Airways, Facial Equipment, then Blow, Tap, Talk.'),
  (11, 'Buddy Tows',                  'Skills & Safety',    'Swim the buddy a distance on the surface. May include simulated rescue breaths.'),
  (12, 'Good Buddy Bad Buddy',        'Skills & Safety',    'One buddy apnea walks, other swims to match pace. Harder on the walker.'),
  (13, 'Dry Face Long Swim',          'Distance & Depth',   'Keep face dry for a max/long swim. More pronounced dive response and CO2 build-up.'),
  (14, 'Gentle Warm Up',              'Relaxation',         'Slow swimming with long recovery between each length.'),
  (15, 'Long Swim Table',             'Distance & Depth',   '90% of PB, 60%, 70%, 80%, 90% of PB.'),
  (16, 'Passive / Exhale Swims',      'Fitness & CO2',      'Passive or full exhale swims.'),
  (17, 'Max Swims',                   'Distance & Depth',   'Max attempts with dedicated buddy alongside. O2 at poolside.'),
  (18, 'Technique Focus',             'Relaxation',         'Technique drills — finning, streamline, head positioning etc.'),
  (19, 'Fixed Distance Count',        'Fitness & CO2',      'Fixed distance, each person swims as fast as possible. Record total time.'),
  (20, 'Reverse CO2 Table',           'Fitness & CO2',      'Fixed distance: start fastest, increase to easy time, back to fastest.')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence after manual IDs
SELECT setval('drills_id_seq', 20);

-- 3. Session plans — one per session date (1:M off sessions)
CREATE TABLE IF NOT EXISTS session_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  plan_date       DATE NOT NULL,           -- the specific date this plan is for
  lane_count      INT  NOT NULL DEFAULT 2,
  lane_names      JSONB NOT NULL DEFAULT '["Lane 1", "Lane 2"]',
  session_notes   TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published'
  created_by      UUID REFERENCES members(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, plan_date)
);

CREATE TRIGGER session_plans_updated_at
  BEFORE UPDATE ON session_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE session_plans ENABLE ROW LEVEL SECURITY;

-- Enrolled members can read published plans for their session
CREATE POLICY "plans_read_enrolled" ON session_plans FOR SELECT
  USING (
    status = 'published'
    AND session_id IN (
      SELECT e.session_id FROM enrolments e
      JOIN members m ON m.id = e.member_id
      WHERE m.auth_user_id = auth.uid() AND e.status = 'enrolled'
    )
  );

-- Leads can read/write plans for sessions they lead
CREATE POLICY "plans_lead_all" ON session_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE auth_user_id = auth.uid()
      AND (is_admin OR is_qualified_lead)
    )
  );

-- 4. Plan blocks — each 10-min slot per lane
CREATE TABLE IF NOT EXISTS plan_blocks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id         UUID NOT NULL REFERENCES session_plans(id) ON DELETE CASCADE,
  lane            INT  NOT NULL,           -- 1, 2, 3...
  time_slot       TEXT NOT NULL,           -- '6:00', '6:10', '6:20' etc
  drill_id        INT  REFERENCES drills(id),
  span            INT  NOT NULL DEFAULT 1, -- how many 10-min blocks this drill spans
  specifics       TEXT,                    -- free text overriding drill default
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE plan_blocks ENABLE ROW LEVEL SECURITY;

-- Same policies as session_plans — join through
CREATE POLICY "blocks_read_enrolled" ON plan_blocks FOR SELECT
  USING (
    plan_id IN (
      SELECT sp.id FROM session_plans sp
      WHERE sp.status = 'published'
      AND sp.session_id IN (
        SELECT e.session_id FROM enrolments e
        JOIN members m ON m.id = e.member_id
        WHERE m.auth_user_id = auth.uid() AND e.status = 'enrolled'
      )
    )
  );

CREATE POLICY "blocks_lead_all" ON plan_blocks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE auth_user_id = auth.uid()
      AND (is_admin OR is_qualified_lead)
    )
  );
