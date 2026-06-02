CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.hotelbeds_hotels (
  code BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT,
  destination_code TEXT,
  destination_name TEXT,
  zone_code TEXT,
  city TEXT,
  state_code TEXT,
  address TEXT,
  postal_code TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  phones JSONB,
  email TEXT,
  web TEXT,
  category_code TEXT,
  category_name TEXT,
  chain_code TEXT,
  accommodation_type_code TEXT,
  description TEXT,
  images JSONB,
  facilities JSONB,
  raw JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hb_hotels_destination ON public.hotelbeds_hotels(destination_code);
CREATE INDEX idx_hb_hotels_country ON public.hotelbeds_hotels(country_code);
CREATE INDEX idx_hb_hotels_name_trgm ON public.hotelbeds_hotels USING GIN (name gin_trgm_ops);

GRANT SELECT ON public.hotelbeds_hotels TO authenticated;
GRANT ALL ON public.hotelbeds_hotels TO service_role;

ALTER TABLE public.hotelbeds_hotels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read hotelbeds hotels"
  ON public.hotelbeds_hotels FOR SELECT
  TO authenticated USING (true);

CREATE TABLE public.hotelbeds_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  hotels_processed INT NOT NULL DEFAULT 0,
  hotels_upserted INT NOT NULL DEFAULT 0,
  pages_fetched INT NOT NULL DEFAULT 0,
  error TEXT,
  triggered_by TEXT
);

GRANT SELECT ON public.hotelbeds_sync_runs TO authenticated;
GRANT ALL ON public.hotelbeds_sync_runs TO service_role;

ALTER TABLE public.hotelbeds_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync runs"
  ON public.hotelbeds_sync_runs FOR SELECT
  TO authenticated USING (public.is_recon_admin());

CREATE TRIGGER trg_hb_hotels_updated_at
  BEFORE UPDATE ON public.hotelbeds_hotels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();