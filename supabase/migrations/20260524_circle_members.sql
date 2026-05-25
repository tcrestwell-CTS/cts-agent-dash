-- Circle members table with tier support
-- Run in CTS Supabase (zbtnulzvwreqzbmxulpv)

CREATE TABLE IF NOT EXISTS circle_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  tier             TEXT NOT NULL DEFAULT 'circle'
    CHECK (tier IN ('circle','premier','founders_society')),
  founding_member  BOOLEAN DEFAULT FALSE,
  trial_ends_at    TIMESTAMPTZ,
  source           TEXT DEFAULT 'landing_page',
  status           TEXT DEFAULT 'active'
    CHECK (status IN ('active','unsubscribed','cancelled')),
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  notes            TEXT
);

ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;

-- Public can join (insert only)
CREATE POLICY "anon_insert_circle" ON circle_members
  FOR INSERT TO anon WITH CHECK (true);

-- Public can read founder count (for urgency counter on landing page)
CREATE POLICY "anon_count_founders" ON circle_members
  FOR SELECT TO anon USING (true);

-- Agents have full access
CREATE POLICY "agent_full_access_circle" ON circle_members
  FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_circle_members_email         ON circle_members(email);
CREATE INDEX IF NOT EXISTS idx_circle_members_founding      ON circle_members(founding_member);
CREATE INDEX IF NOT EXISTS idx_circle_members_status        ON circle_members(status);
