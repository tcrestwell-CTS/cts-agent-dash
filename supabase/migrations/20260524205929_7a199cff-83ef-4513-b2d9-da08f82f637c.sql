CREATE TABLE IF NOT EXISTS public.car_rental_requests (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  trip_type                   TEXT NOT NULL CHECK (trip_type IN ('round-trip','one-way')),
  pickup_location             TEXT NOT NULL,
  dropoff_location            TEXT,
  pickup_date                 DATE NOT NULL,
  pickup_time                 TEXT NOT NULL,
  return_date                 DATE,
  return_time                 TEXT,
  flight_number               TEXT,

  vehicle_class               TEXT NOT NULL,
  provider                    TEXT NOT NULL,
  loyalty_number              TEXT,

  driver_name                 TEXT NOT NULL,
  driver_email                TEXT NOT NULL,
  driver_phone                TEXT,
  driver_age_range            TEXT,
  additional_drivers          INTEGER DEFAULT 0,
  notes                       TEXT,

  cc_auth_cardholder_name     TEXT,
  cc_auth_last_four           TEXT,
  cc_auth_exp_month           TEXT,
  cc_auth_exp_year            TEXT,
  cc_auth_billing_zip         TEXT,
  cc_auth_stripe_pm_id        TEXT,
  cc_authorized               BOOLEAN NOT NULL DEFAULT FALSE,
  cc_authorized_at            TIMESTAMPTZ,

  client_id                   UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  trip_id                     UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  assigned_agent              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  status                      TEXT NOT NULL DEFAULT 'new'
                                CHECK (status IN ('new','pending','confirmed','cancelled','completed')),
  agent_notes                 TEXT,
  confirmation_number         TEXT,
  provider_booking_ref        TEXT,
  estimated_total             NUMERIC(10,2),
  actual_total                NUMERIC(10,2),

  source                      TEXT DEFAULT 'website'
);

ALTER TABLE public.car_rental_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated agents can view car rental requests"
  ON public.car_rental_requests FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated agents can insert car rental requests"
  ON public.car_rental_requests FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated agents can update car rental requests"
  ON public.car_rental_requests FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated agents can delete car rental requests"
  ON public.car_rental_requests FOR DELETE
  TO authenticated USING (true);

-- Allow anonymous inserts from the public website form
CREATE POLICY "Anon can submit car rental requests"
  ON public.car_rental_requests FOR INSERT
  TO anon WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_car_rentals_client   ON public.car_rental_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_car_rentals_status   ON public.car_rental_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_car_rentals_provider ON public.car_rental_requests(provider);
CREATE INDEX IF NOT EXISTS idx_car_rentals_pickup   ON public.car_rental_requests(pickup_date);
CREATE INDEX IF NOT EXISTS idx_car_rentals_email    ON public.car_rental_requests(driver_email);

CREATE TRIGGER trg_car_rental_requests_updated_at
  BEFORE UPDATE ON public.car_rental_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();