-- Car rental requests table
-- Run in CTS Supabase (zbtnulzvwreqzbmxulpv) SQL Editor

CREATE TABLE IF NOT EXISTS car_rental_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),

  -- Trip details
  trip_type               TEXT NOT NULL CHECK (trip_type IN ('round-trip','one-way')),
  pickup_location         TEXT NOT NULL,
  dropoff_location        TEXT,
  pickup_date             DATE NOT NULL,
  pickup_time             TEXT NOT NULL,
  return_date             DATE,
  return_time             TEXT,
  flight_number           TEXT,

  -- Vehicle & provider
  vehicle_class           TEXT NOT NULL,
  provider                TEXT NOT NULL,
  loyalty_number          TEXT,

  -- Driver info
  driver_name             TEXT NOT NULL,
  driver_email            TEXT NOT NULL,
  driver_phone            TEXT,
  driver_age_range        TEXT,
  additional_drivers      INTEGER DEFAULT 0,
  notes                   TEXT,

  -- CC Authorization (last 4 only — never full PAN)
  cc_cardholder_name      TEXT,
  cc_last_four            TEXT,
  cc_expiry               TEXT,
  cc_billing_zip          TEXT,
  cc_stripe_pm_id         TEXT,
  cc_authorized           BOOLEAN DEFAULT FALSE,
  cc_authorized_at        TIMESTAMPTZ,

  -- CRM linkage
  client_id               UUID REFERENCES clients(id) ON DELETE SET NULL,
  trip_id                 UUID REFERENCES trips(id) ON DELETE SET NULL,
  assigned_agent          UUID REFERENCES auth.users(id),

  -- Status workflow
  status                  TEXT DEFAULT 'new' CHECK (status IN ('new','pending','confirmed','cancelled','completed')),
  agent_notes             TEXT,
  confirmation_number     TEXT,
  provider_booking_ref    TEXT,
  estimated_total         NUMERIC(10,2),
  actual_total            NUMERIC(10,2),

  source                  TEXT DEFAULT 'website'
);

ALTER TABLE car_rental_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_full_access" ON car_rental_requests
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_car_rentals_client   ON car_rental_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_car_rentals_status   ON car_rental_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_car_rentals_provider ON car_rental_requests(provider);
CREATE INDEX IF NOT EXISTS idx_car_rentals_pickup   ON car_rental_requests(pickup_date);
CREATE INDEX IF NOT EXISTS idx_car_rentals_email    ON car_rental_requests(driver_email);
