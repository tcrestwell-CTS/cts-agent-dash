-- =============================================================================
-- MIGRATION: margin_engine_v1 (safe re-run)
-- =============================================================================

-- 1. Add margin summary columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS agency_gross_margin   numeric   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advisor_split_pct     numeric   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_split_pct      numeric   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advisor_margin_amount numeric   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_margin_amount  numeric   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_mode          text      NOT NULL DEFAULT 'commission',
  ADD COLUMN IF NOT EXISTS margin_locked         boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS margin_version        integer   NOT NULL DEFAULT 1;

-- 2. Create booking_margin_lines table
CREATE TABLE IF NOT EXISTS public.booking_margin_lines (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL,
  line_type        text        NOT NULL DEFAULT 'package'
                               CHECK (line_type IN ('hotel','flight','transfer','cruise',
                                                    'insurance','service_fee','package',
                                                    'excursion','other')),
  description      text        NOT NULL DEFAULT '',
  source           text        NOT NULL DEFAULT 'manual'
                               CHECK (source IN ('manual','hotelbeds','duffel',
                                                 'amadeus','sabre','synthetic')),
  quantity         numeric     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost        numeric     NOT NULL DEFAULT 0,
  unit_sell        numeric     NOT NULL DEFAULT 0,
  total_cost       numeric     GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  total_sell       numeric     GENERATED ALWAYS AS (quantity * unit_sell) STORED,
  margin_amount    numeric     GENERATED ALWAYS AS (quantity * (unit_sell - unit_cost)) STORED,
  margin_rule_id   uuid,
  is_pass_through  boolean     NOT NULL DEFAULT false,
  sort_order       integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bml_booking_id ON public.booking_margin_lines(booking_id);
CREATE INDEX IF NOT EXISTS idx_bml_user_id    ON public.booking_margin_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_bml_source     ON public.booking_margin_lines(source);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_bml_updated_at ON public.booking_margin_lines;
CREATE TRIGGER trg_bml_updated_at
  BEFORE UPDATE ON public.booking_margin_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS on booking_margin_lines
ALTER TABLE public.booking_margin_lines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own margin lines"   ON public.booking_margin_lines;
  DROP POLICY IF EXISTS "Users can insert their own margin lines" ON public.booking_margin_lines;
  DROP POLICY IF EXISTS "Users can update their own margin lines" ON public.booking_margin_lines;
  DROP POLICY IF EXISTS "Users can delete their own margin lines" ON public.booking_margin_lines;
  DROP POLICY IF EXISTS "Admins can view all margin lines"        ON public.booking_margin_lines;
  DROP POLICY IF EXISTS "Admins can manage all margin lines"      ON public.booking_margin_lines;
END $$;

CREATE POLICY "Users can view their own margin lines"
  ON public.booking_margin_lines FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own margin lines"
  ON public.booking_margin_lines FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own margin lines"
  ON public.booking_margin_lines FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own margin lines"
  ON public.booking_margin_lines FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all margin lines"
  ON public.booking_margin_lines FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all margin lines"
  ON public.booking_margin_lines FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. get_advisor_split_pct
CREATE OR REPLACE FUNCTION public.get_advisor_split_pct(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier text;
BEGIN
  SELECT commission_tier::text
  INTO   v_tier
  FROM   public.profiles
  WHERE  user_id = p_user_id
  LIMIT  1;

  RETURN CASE COALESCE(v_tier, 'tier_1')
    WHEN 'tier_3' THEN 0.95
    WHEN 'tier_2' THEN 0.80
    WHEN 'tier_1' THEN 0.70
    WHEN 'none'   THEN 0.00
    ELSE                0.70
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_split_pct(uuid) TO authenticated;

-- 5. calculate_booking_margin RPC
CREATE OR REPLACE FUNCTION public.calculate_booking_margin(
  p_booking_id    uuid,
  p_advisor_split numeric  DEFAULT NULL,
  p_force_recalc  boolean  DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking          public.bookings%ROWTYPE;
  v_total_sell       numeric := 0;
  v_total_cost       numeric := 0;
  v_gross_margin     numeric := 0;
  v_advisor_split    numeric := 0;
  v_agency_split     numeric := 0;
  v_advisor_amount   numeric := 0;
  v_agency_amount    numeric := 0;
  v_next_version     integer;
  v_has_lines        boolean;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  IF v_booking.margin_locked = true AND p_force_recalc = false THEN
    RETURN jsonb_build_object(
      'booking_id',            p_booking_id,
      'status',                'locked',
      'agency_gross_margin',   v_booking.agency_gross_margin,
      'advisor_split_pct',     v_booking.advisor_split_pct,
      'agency_split_pct',      v_booking.agency_split_pct,
      'advisor_margin_amount', v_booking.advisor_margin_amount,
      'agency_margin_amount',  v_booking.agency_margin_amount,
      'margin_version',        v_booking.margin_version
    );
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.booking_margin_lines WHERE booking_id = p_booking_id
  ) INTO v_has_lines;

  IF v_has_lines THEN
    SELECT
      COALESCE(SUM(total_sell), 0),
      COALESCE(SUM(CASE WHEN is_pass_through = false THEN total_cost ELSE 0 END), 0)
    INTO v_total_sell, v_total_cost
    FROM public.booking_margin_lines
    WHERE booking_id = p_booking_id;
  ELSE
    v_total_sell := COALESCE(v_booking.gross_sales, 0);
    v_total_cost := COALESCE(v_booking.supplier_payout, 0);
  END IF;

  v_gross_margin := v_total_sell - v_total_cost;

  IF p_advisor_split IS NOT NULL THEN
    v_advisor_split := GREATEST(0.0, LEAST(1.0, p_advisor_split));
  ELSE
    v_advisor_split := public.get_advisor_split_pct(v_booking.user_id);
  END IF;

  v_agency_split := 1.0 - v_advisor_split;

  v_advisor_amount := ROUND(v_gross_margin * v_advisor_split, 2);
  v_agency_amount  := ROUND(v_gross_margin * v_agency_split, 2);

  IF (v_advisor_amount + v_agency_amount) <> v_gross_margin THEN
    v_agency_amount := v_gross_margin - v_advisor_amount;
  END IF;

  v_next_version := COALESCE(v_booking.margin_version, 0) + 1;

  UPDATE public.bookings SET
    agency_gross_margin   = v_gross_margin,
    advisor_split_pct     = v_advisor_split,
    agency_split_pct      = v_agency_split,
    advisor_margin_amount = v_advisor_amount,
    agency_margin_amount  = v_agency_amount,
    margin_version        = v_next_version
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'booking_id',            p_booking_id,
    'status',                'calculated',
    'total_sell',            v_total_sell,
    'total_cost',            v_total_cost,
    'agency_gross_margin',   v_gross_margin,
    'advisor_split_pct',     v_advisor_split,
    'agency_split_pct',      v_agency_split,
    'advisor_margin_amount', v_advisor_amount,
    'agency_margin_amount',  v_agency_amount,
    'margin_version',        v_next_version,
    'margin_pct',            CASE WHEN v_total_sell > 0
                               THEN ROUND((v_gross_margin / v_total_sell) * 100, 2)
                               ELSE 0
                             END,
    'source',                CASE WHEN v_has_lines THEN 'margin_lines' ELSE 'legacy_fields' END
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'status',     'error',
    'error',      SQLERRM,
    'detail',     SQLSTATE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_booking_margin(uuid, numeric, boolean) TO authenticated;