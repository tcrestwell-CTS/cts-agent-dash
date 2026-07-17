CREATE TABLE public.destinations (
  code text PRIMARY KEY,
  name text NOT NULL,
  country_code text NOT NULL,
  zone_count int,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.destinations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destinations TO authenticated;
GRANT ALL ON public.destinations TO service_role;

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon read destinations"
  ON public.destinations FOR SELECT
  TO anon USING (true);

CREATE POLICY "authenticated read destinations"
  ON public.destinations FOR SELECT
  TO authenticated USING (true);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX destinations_name_trgm_idx
  ON public.destinations USING gin (name gin_trgm_ops);