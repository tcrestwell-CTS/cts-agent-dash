CREATE OR REPLACE FUNCTION public.calculate_booking_margin(
  p_booking_id uuid,
  p_advisor_split numeric DEFAULT NULL,
  p_force_recalc boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_source           text;
  v_margin_pct       numeric := 0;
  v_warnings         jsonb   := '[]'::jsonb;
  v_rule             RECORD;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
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
      'margin_version',        v_booking.margin_version,
      'warnings',              '[]'::jsonb
    );
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.booking_margin_lines WHERE booking_id = p_booking_id
  ) INTO v_has_lines;

  IF v_has_lines THEN
    v_source := 'margin_lines';
    SELECT
      COALESCE(SUM(total_sell), 0),
      COALESCE(SUM(total_cost), 0)
    INTO v_total_sell, v_total_cost
    FROM public.booking_margin_lines
    WHERE booking_id = p_booking_id;
  ELSE
    v_source := 'legacy_fields';
    v_total_sell := COALESCE(v_booking.gross_sales, 0);
    v_total_cost := COALESCE(v_booking.supplier_payout, 0);
  END IF;

  v_gross_margin  := v_total_sell - v_total_cost;
  v_margin_pct    := CASE WHEN v_total_sell > 0
                       THEN ROUND((v_gross_margin / v_total_sell) * 100, 2)
                       ELSE 0
                     END;

  v_advisor_split := CASE
    WHEN p_advisor_split IS NOT NULL
    THEN GREATEST(0.0, LEAST(1.0, p_advisor_split))
    ELSE public.get_advisor_split_pct(v_booking.user_id)
  END;
  v_agency_split   := 1.0 - v_advisor_split;
  v_advisor_amount := ROUND(v_gross_margin * v_advisor_split, 2);
  v_agency_amount  := ROUND(v_gross_margin * v_agency_split,  2);

  IF (v_advisor_amount + v_agency_amount) <> v_gross_margin THEN
    v_agency_amount := v_gross_margin - v_advisor_amount;
  END IF;

  v_next_version := COALESCE(v_booking.margin_version, 0) + 1;

  -- Check min_margin_pct rules
  FOR v_rule IN
    SELECT id, name, rule_value, supplier_id
    FROM public.agency_margin_rules
    WHERE rule_type  = 'min_margin_pct'
      AND is_active  = true
      AND (supplier_id IS NULL OR supplier_id = v_booking.supplier_id)
    ORDER BY
      CASE WHEN supplier_id IS NOT NULL THEN 0 ELSE 1 END,
      priority DESC
    LIMIT 1
  LOOP
    IF v_margin_pct < v_rule.rule_value THEN
      v_warnings := v_warnings || jsonb_build_object(
        'rule_id',       v_rule.id,
        'rule_name',     v_rule.name,
        'rule_type',     'min_margin_pct',
        'required_value', v_rule.rule_value,
        'actual_value',   v_margin_pct,
        'message',       format(
          'Margin %.1f%% is below minimum %.1f%% required by rule "%s"',
          v_margin_pct, v_rule.rule_value, v_rule.name
        )
      );
    END IF;
  END LOOP;

  -- Write back to bookings — syncs gross_sales, supplier_payout, and commission_revenue from lines
  UPDATE public.bookings SET
    gross_sales           = v_total_sell,
    supplier_payout       = v_total_cost,
    net_sales             = v_gross_margin,
    total_price           = v_total_sell,
    agency_gross_margin   = v_gross_margin,
    advisor_split_pct     = v_advisor_split,
    agency_split_pct      = v_agency_split,
    advisor_margin_amount = v_advisor_amount,
    agency_margin_amount  = v_agency_amount,
    commission_revenue    = v_advisor_amount,
    commissionable_amount = v_gross_margin,
    margin_version        = v_next_version
  WHERE id = p_booking_id;

  -- Audit row
  INSERT INTO public.booking_margin_audit (
    booking_id, calculated_by, margin_version,
    total_sell, total_cost, agency_gross_margin,
    advisor_split_pct, agency_split_pct,
    advisor_margin_amount, agency_margin_amount,
    source, triggered_by, pricing_mode
  ) VALUES (
    p_booking_id, v_booking.user_id, v_next_version,
    v_total_sell, v_total_cost, v_gross_margin,
    v_advisor_split, v_agency_split,
    v_advisor_amount, v_agency_amount,
    v_source, 'rpc_call', v_booking.pricing_mode
  );

  RETURN jsonb_build_object(
    'booking_id',            p_booking_id,
    'status',                'recalculated',
    'source',                v_source,
    'total_sell',            v_total_sell,
    'total_cost',            v_total_cost,
    'agency_gross_margin',   v_gross_margin,
    'margin_pct',            v_margin_pct,
    'advisor_split_pct',     v_advisor_split,
    'agency_split_pct',      v_agency_split,
    'advisor_margin_amount', v_advisor_amount,
    'agency_margin_amount',  v_agency_amount,
    'margin_version',        v_next_version,
    'warnings',              v_warnings
  );
END;
$function$;