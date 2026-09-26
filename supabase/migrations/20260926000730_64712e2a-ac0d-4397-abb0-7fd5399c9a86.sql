CREATE TABLE public.ratehawk_hotels (
  id text PRIMARY KEY,
  hid bigint,
  name text,
  address text,
  region_id integer,
  region_name text,
  country_code text,
  star_rating integer,
  latitude numeric,
  longitude numeric,
  amenity_groups jsonb,
  images_ext jsonb,
  room_groups jsonb,
  metapolicy_struct jsonb,
  metapolicy_extra_info text,
  facts jsonb,
  check_in_time text,
  check_out_time text,
  phone text,
  email text,
  raw jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ratehawk_hotels TO anon, authenticated;
GRANT ALL ON public.ratehawk_hotels TO service_role;
ALTER TABLE public.ratehawk_hotels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read ratehawk hotels" ON public.ratehawk_hotels FOR SELECT TO authenticated USING (true);
CREATE POLICY "anon read ratehawk hotel cache" ON public.ratehawk_hotels FOR SELECT TO anon USING (true);
CREATE INDEX idx_rh_hotels_region ON public.ratehawk_hotels (region_id);
CREATE INDEX idx_rh_hotels_country ON public.ratehawk_hotels (country_code);
CREATE INDEX idx_rh_hotels_hid ON public.ratehawk_hotels (hid);
CREATE INDEX idx_rh_hotels_name_trgm ON public.ratehawk_hotels USING gin (name gin_trgm_ops);
CREATE TRIGGER update_ratehawk_hotels_updated_at BEFORE UPDATE ON public.ratehawk_hotels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ratehawk_search_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ratehawk_search_cache TO service_role;
ALTER TABLE public.ratehawk_search_cache ENABLE ROW LEVEL SECURITY;
CREATE INDEX ratehawk_search_cache_expires_idx ON public.ratehawk_search_cache (expires_at);

CREATE TABLE public.ratehawk_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  hotels_processed integer NOT NULL DEFAULT 0,
  hotels_upserted integer NOT NULL DEFAULT 0,
  pages_fetched integer NOT NULL DEFAULT 0,
  error text,
  triggered_by text
);
GRANT SELECT ON public.ratehawk_sync_runs TO authenticated;
GRANT ALL ON public.ratehawk_sync_runs TO service_role;
ALTER TABLE public.ratehawk_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view ratehawk sync runs" ON public.ratehawk_sync_runs FOR SELECT TO authenticated USING (public.is_recon_admin());

CREATE TABLE public.ratehawk_api_usage (
  day date PRIMARY KEY,
  search_calls integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ratehawk_api_usage TO service_role;
ALTER TABLE public.ratehawk_api_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ratehawk_increment_search_usage(_cap integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _count integer;
BEGIN
  INSERT INTO public.ratehawk_api_usage (day, search_calls, updated_at)
  VALUES (current_date, 1, now())
  ON CONFLICT (day) DO UPDATE
    SET search_calls = public.ratehawk_api_usage.search_calls + 1,
        updated_at = now()
  RETURNING search_calls INTO _count;

  IF _count > _cap THEN
    RETURN -1;
  END IF;
  RETURN _count;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.ratehawk_increment_search_usage(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ratehawk_increment_search_usage(integer) TO service_role;