CREATE TABLE IF NOT EXISTS public.qbo_report_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  report_type     TEXT NOT NULL,
  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  data            JSONB NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_type, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_qbo_report_cache_lookup
  ON public.qbo_report_cache (report_type, period_year, period_month, fetched_at DESC);

ALTER TABLE public.qbo_report_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bookkeepers and admins can read report cache"
  ON public.qbo_report_cache
  FOR SELECT
  USING (
    public.is_bookkeeper(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );

CREATE POLICY "Admins can manage report cache"
  ON public.qbo_report_cache
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));