CREATE TABLE IF NOT EXISTS public.hotelbeds_search_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS hotelbeds_search_cache_expires_idx ON public.hotelbeds_search_cache (expires_at);
GRANT ALL ON public.hotelbeds_search_cache TO service_role;
ALTER TABLE public.hotelbeds_search_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hotelbeds_api_usage (
  day date PRIMARY KEY,
  search_calls integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hotelbeds_api_usage TO service_role;
ALTER TABLE public.hotelbeds_api_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.hotelbeds_increment_search_usage(_cap integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  INSERT INTO public.hotelbeds_api_usage (day, search_calls, updated_at)
  VALUES (current_date, 1, now())
  ON CONFLICT (day) DO UPDATE
    SET search_calls = public.hotelbeds_api_usage.search_calls + 1,
        updated_at = now()
  RETURNING search_calls INTO _count;

  IF _count > _cap THEN
    RETURN -1;
  END IF;
  RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.hotelbeds_increment_search_usage(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hotelbeds_increment_search_usage(integer) TO service_role;