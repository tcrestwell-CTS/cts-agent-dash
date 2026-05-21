-- Period locks table
CREATE TABLE IF NOT EXISTS public.period_locks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  locked_by       UUID REFERENCES auth.users(id),
  locked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT,
  UNIQUE (period_year, period_month)
);

ALTER TABLE public.period_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON public.period_locks
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "bookkeeper_read" ON public.period_locks
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_bookkeeper(auth.uid())
  );

-- Generic period-lock check helpers (one per table because column names differ)
CREATE OR REPLACE FUNCTION public.check_period_lock_trip_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref date;
BEGIN
  v_ref := COALESCE(NEW.payment_date, NEW.due_date, CURRENT_DATE);
  IF EXISTS (
    SELECT 1 FROM public.period_locks
    WHERE period_year  = EXTRACT(YEAR  FROM v_ref)::int
      AND period_month = EXTRACT(MONTH FROM v_ref)::int
  ) THEN
    RAISE EXCEPTION 'Period % is locked. Contact your administrator.', to_char(v_ref, 'YYYY-MM');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_period_lock_commissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref date;
BEGIN
  v_ref := COALESCE(NEW.paid_date::date, CURRENT_DATE);
  IF EXISTS (
    SELECT 1 FROM public.period_locks
    WHERE period_year  = EXTRACT(YEAR  FROM v_ref)::int
      AND period_month = EXTRACT(MONTH FROM v_ref)::int
  ) THEN
    RAISE EXCEPTION 'Period % is locked. Contact your administrator.', to_char(v_ref, 'YYYY-MM');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_period_lock ON public.trip_payments;
CREATE TRIGGER enforce_period_lock
  BEFORE INSERT OR UPDATE ON public.trip_payments
  FOR EACH ROW EXECUTE FUNCTION public.check_period_lock_trip_payments();

DROP TRIGGER IF EXISTS enforce_period_lock_commissions ON public.commissions;
CREATE TRIGGER enforce_period_lock_commissions
  BEFORE INSERT OR UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.check_period_lock_commissions();

-- Financial packet generation log
CREATE TABLE IF NOT EXISTS public.financial_packets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  generated_by    UUID REFERENCES auth.users(id),
  storage_path    TEXT,
  status          TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed'))
);

ALTER TABLE public.financial_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_bookkeeper_read" ON public.financial_packets
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_bookkeeper(auth.uid())
  );

CREATE POLICY "admin_generate" ON public.financial_packets
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "admin_update" ON public.financial_packets
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role));