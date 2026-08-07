-- ============ MSC Cruises flat-file cache (Phase 1) ============

CREATE TABLE public.msc_ships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_code text NOT NULL UNIQUE,
  ship_name text,
  brand text,
  capacity integer,
  tonnage integer,
  year_built integer,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.msc_ships TO authenticated;
GRANT ALL ON public.msc_ships TO service_role;
ALTER TABLE public.msc_ships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msc_ships_read" ON public.msc_ships FOR SELECT TO authenticated USING (true);

CREATE TABLE public.msc_ports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  port_code text NOT NULL UNIQUE,
  port_name text,
  city_name text,
  country_code text,
  country_name text,
  region_code text,
  latitude numeric,
  longitude numeric,
  language_code text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.msc_ports TO authenticated;
GRANT ALL ON public.msc_ports TO service_role;
ALTER TABLE public.msc_ports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msc_ports_read" ON public.msc_ports FOR SELECT TO authenticated USING (true);

CREATE TABLE public.msc_cruises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id text NOT NULL UNIQUE,
  ship_code text,
  sail_date date,
  return_date date,
  nights integer,
  embark_port_code text,
  disembark_port_code text,
  market_code text NOT NULL DEFAULT 'USA',
  itinerary_name text,
  area_code text,
  region_code text,
  is_closed boolean NOT NULL DEFAULT false,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX msc_cruises_sail_date_idx ON public.msc_cruises (sail_date);
CREATE INDEX msc_cruises_ship_idx ON public.msc_cruises (ship_code);
CREATE INDEX msc_cruises_embark_idx ON public.msc_cruises (embark_port_code);
GRANT SELECT ON public.msc_cruises TO authenticated;
GRANT ALL ON public.msc_cruises TO service_role;
ALTER TABLE public.msc_cruises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msc_cruises_read" ON public.msc_cruises FOR SELECT TO authenticated USING (true);

CREATE TABLE public.msc_itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id text NOT NULL,
  day_number integer NOT NULL,
  day_date date,
  port_code text,
  arrival_time text,
  departure_time text,
  at_sea boolean NOT NULL DEFAULT false,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cruise_id, day_number)
);
CREATE INDEX msc_itineraries_cruise_idx ON public.msc_itineraries (cruise_id);
GRANT SELECT ON public.msc_itineraries TO authenticated;
GRANT ALL ON public.msc_itineraries TO service_role;
ALTER TABLE public.msc_itineraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msc_itineraries_read" ON public.msc_itineraries FOR SELECT TO authenticated USING (true);

CREATE TABLE public.msc_cabin_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_code text NOT NULL,
  category_code text NOT NULL,
  category_name text,
  experience text,
  deck text,
  occupancy_min integer,
  occupancy_max integer,
  description text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ship_code, category_code)
);
GRANT SELECT ON public.msc_cabin_details TO authenticated;
GRANT ALL ON public.msc_cabin_details TO service_role;
ALTER TABLE public.msc_cabin_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msc_cabin_details_read" ON public.msc_cabin_details FOR SELECT TO authenticated USING (true);

CREATE TABLE public.msc_fares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id text NOT NULL,
  fare_code text NOT NULL,
  price_type text,
  category_code text,
  occupancy_key text NOT NULL,
  cabin_price numeric,
  gft_adult numeric,
  gft_child numeric,
  gft_infant numeric,
  service_charge_adult_promo numeric,
  service_charge_adult_standard numeric,
  service_charge_child_promo numeric,
  service_charge_child_standard numeric,
  ncf_included boolean NOT NULL DEFAULT true,
  currency_code text NOT NULL DEFAULT 'USD',
  market_code text NOT NULL DEFAULT 'USA',
  source text NOT NULL DEFAULT 'market',
  agency_code text,
  is_closed boolean NOT NULL DEFAULT false,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cruise_id, fare_code, category_code, occupancy_key, source)
);
CREATE INDEX msc_fares_cruise_idx ON public.msc_fares (cruise_id);
CREATE INDEX msc_fares_source_idx ON public.msc_fares (source);
GRANT SELECT ON public.msc_fares TO authenticated;
GRANT ALL ON public.msc_fares TO service_role;
ALTER TABLE public.msc_fares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msc_fares_read" ON public.msc_fares FOR SELECT TO authenticated USING (true);

CREATE TABLE public.msc_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_id text NOT NULL,
  fare_code text,
  item_type text NOT NULL,
  item_code text NOT NULL,
  applicability text,
  item_name text,
  price numeric,
  currency_code text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX msc_items_cruise_idx ON public.msc_items (cruise_id);
GRANT SELECT ON public.msc_items TO authenticated;
GRANT ALL ON public.msc_items TO service_role;
ALTER TABLE public.msc_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msc_items_read" ON public.msc_items FOR SELECT TO authenticated USING (true);

CREATE TABLE public.msc_flatfile_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_code text NOT NULL DEFAULT 'USA',
  source text NOT NULL DEFAULT 'market',
  file_name text,
  status text NOT NULL DEFAULT 'running',
  rows_processed integer NOT NULL DEFAULT 0,
  rows_upserted integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.msc_flatfile_sync_runs TO authenticated;
GRANT ALL ON public.msc_flatfile_sync_runs TO service_role;
ALTER TABLE public.msc_flatfile_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msc_sync_runs_read" ON public.msc_flatfile_sync_runs FOR SELECT TO authenticated USING (true);

CREATE TRIGGER msc_ships_updated_at BEFORE UPDATE ON public.msc_ships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER msc_ports_updated_at BEFORE UPDATE ON public.msc_ports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER msc_cruises_updated_at BEFORE UPDATE ON public.msc_cruises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER msc_itineraries_updated_at BEFORE UPDATE ON public.msc_itineraries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER msc_cabin_details_updated_at BEFORE UPDATE ON public.msc_cabin_details FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER msc_fares_updated_at BEFORE UPDATE ON public.msc_fares FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER msc_items_updated_at BEFORE UPDATE ON public.msc_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER msc_sync_runs_updated_at BEFORE UPDATE ON public.msc_flatfile_sync_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();