-- Seed insurance_providers reference table
-- Run in CTS Supabase (zbtnulzvwreqzbmxulpv) SQL Editor

CREATE TABLE IF NOT EXISTS insurance_providers (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  short_name   TEXT NOT NULL,
  brand_color  TEXT,
  website      TEXT,
  logo_url     TEXT,
  active       BOOLEAN DEFAULT TRUE,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO insurance_providers (id, name, short_name, brand_color, website, sort_order)
VALUES
  ('chubb',      'Chubb Travel Protection',  'Chubb',      '#c8102e', 'https://agent.chubbtravelinsurance.com/main', 1),
  ('worldtrips', 'WorldTrips',               'WorldTrips', '#0057a8', 'https://pas.worldtrips.com/dashboard/policies', 2),
  ('allianz',    'Allianz Travel Insurance', 'Allianz',    '#003781', 'https://sellallianzpartners.com/index.php', 3),
  ('faye',       'Faye Travel Insurance',    'Faye',       '#6366f1', 'https://advisors.withfaye.com/dashboard', 4)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  short_name  = EXCLUDED.short_name,
  brand_color = EXCLUDED.brand_color,
  website     = EXCLUDED.website,
  sort_order  = EXCLUDED.sort_order;

-- Add provider_id to trip_insurance_quotes for catalog linkage
ALTER TABLE trip_insurance_quotes
  ADD COLUMN IF NOT EXISTS provider_id TEXT REFERENCES insurance_providers(id);

-- Backfill provider_id from provider_name
UPDATE trip_insurance_quotes q
SET provider_id = p.id
FROM insurance_providers p
WHERE lower(q.provider_name) LIKE '%' || lower(p.short_name) || '%'
  AND q.provider_id IS NULL;
