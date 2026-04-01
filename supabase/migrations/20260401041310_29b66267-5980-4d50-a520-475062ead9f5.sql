CREATE OR REPLACE FUNCTION public.auto_calculate_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supplier_rate numeric;
  v_supplier_type text;
  v_override_commission boolean;
  v_multi_line boolean;
  v_net_sales numeric;
  v_commission numeric;
  v_line_commission numeric;
  v_has_margin_lines boolean;
BEGIN
  -- Only auto-calc if no manual override
  IF NEW.commission_override_amount IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- If booking_margin_lines exist, the calculate_booking_margin RPC is the source of truth.
  -- Skip legacy auto-calculation to avoid overwriting RPC results.
  SELECT EXISTS(
    SELECT 1 FROM public.booking_margin_lines WHERE booking_id = NEW.id
  ) INTO v_has_margin_lines;

  IF v_has_margin_lines THEN
    RETURN NEW;
  END IF;

  -- Get supplier commission info
  IF NEW.supplier_id IS NOT NULL THEN
    SELECT commission_rate, supplier_type, override_commission, multi_line_commission
    INTO v_supplier_rate, v_supplier_type, v_override_commission, v_multi_line
    FROM public.suppliers WHERE id = NEW.supplier_id;
  END IF;

  -- If multi-line commission, sum from booking_commission_lines
  IF v_multi_line IS TRUE THEN
    SELECT COALESCE(SUM(commission_amount), 0)
    INTO v_line_commission
    FROM public.booking_commission_lines
    WHERE booking_id = NEW.id;
    
    NEW.net_sales := NEW.gross_sales - COALESCE(NEW.supplier_payout, 0);
    NEW.commissionable_amount := NEW.gross_sales;
    NEW.commission_revenue := ROUND(v_line_commission, 2);
    NEW.calculated_commission := ROUND(v_line_commission, 2);
    RETURN NEW;
  END IF;

  -- Check if this is an airline booking using flat rate
  IF v_supplier_type = 'airline' AND (v_override_commission IS NOT TRUE) THEN
    v_commission := (NEW.gross_sales / 500.0) * 25.0;
    
    NEW.commissionable_amount := NEW.gross_sales;
    NEW.commission_revenue := ROUND(v_commission, 2);
    NEW.calculated_commission := ROUND(v_commission, 2);
    NEW.net_sales := NEW.gross_sales - COALESCE(NEW.supplier_payout, 0);
  ELSIF v_supplier_rate IS NOT NULL THEN
    v_net_sales := NEW.gross_sales - COALESCE(NEW.supplier_payout, 0);
    v_commission := v_net_sales * (v_supplier_rate / 100);
    
    NEW.commissionable_amount := v_net_sales;
    NEW.commission_revenue := ROUND(v_commission, 2);
    NEW.calculated_commission := ROUND(v_commission, 2);
    NEW.net_sales := v_net_sales;
  ELSE
    v_net_sales := NEW.gross_sales - COALESCE(NEW.supplier_payout, 0);
    NEW.commissionable_amount := v_net_sales;
    NEW.net_sales := v_net_sales;
    NEW.commission_revenue := 0;
    NEW.calculated_commission := 0;
  END IF;

  RETURN NEW;
END;
$function$;