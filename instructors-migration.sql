CREATE TABLE IF NOT EXISTS instructors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  title       TEXT,          -- e.g. "AIDA Instructor", "Freediving NZ"
  bio         TEXT,          -- short description of their offering
  phone       TEXT,
  email       TEXT,
  website     TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instructors_read_all" ON instructors FOR SELECT USING (true);
CREATE POLICY "instructors_admin_all" ON instructors FOR ALL USING (is_admin());
