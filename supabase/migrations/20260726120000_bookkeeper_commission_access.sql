-- Role-scoped commissions (UI refresh handoff, Step 4b)
--
-- 1. Bookkeepers already have read access to commission_splits but not to the
--    underlying commissions table itself, even though src/pages/bookkeeper/
--    BookkeeperPayouts.tsx already queries commissions directly. Add the
--    missing read policy, mirroring the existing office_admin one.
--
-- 2. confirm_commission_payout (the actual "settle" action) currently allows
--    admin + office_admin. Per product decision, settle access moves to
--    admin + bookkeeper (office_admin keeps read access to the agency-wide
--    report and splits, but can no longer confirm a payout).

CREATE POLICY "Bookkeepers can view all commissions"
  ON public.commissions
  FOR SELECT
  USING (public.is_bookkeeper(auth.uid()));

CREATE OR REPLACE FUNCTION public.confirm_commission_payout(p_edits jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edit jsonb;
  v_split jsonb;
  v_commission_id uuid;
  v_paid_date date;
  v_confirmed int := 0;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT (has_role(v_uid, 'admin'::app_role) OR is_bookkeeper(v_uid)) THEN
    RAISE EXCEPTION 'Unauthorized: admin or bookkeeper required';
  END IF;

  FOR v_edit IN SELECT * FROM jsonb_array_elements(p_edits)
  LOOP
    v_commission_id := (v_edit->>'commission_id')::uuid;
    v_paid_date := COALESCE(NULLIF(v_edit->>'paid_date','')::date, CURRENT_DATE);

    -- Replace splits for this commission
    DELETE FROM public.commission_splits
    WHERE commission_id = v_commission_id AND status <> 'paid';

    FOR v_split IN SELECT * FROM jsonb_array_elements(v_edit->'splits')
    LOOP
      INSERT INTO public.commission_splits (
        commission_id, recipient_user_id, role, percent, amount,
        status, notes, confirmed_at, confirmed_by, paid_date, created_by
      ) VALUES (
        v_commission_id,
        NULLIF(v_split->>'recipient_user_id','')::uuid,
        v_split->>'role',
        NULLIF(v_split->>'percent','')::numeric,
        COALESCE(NULLIF(v_split->>'amount','')::numeric, 0),
        'confirmed',
        v_split->>'notes',
        now(),
        v_uid,
        v_paid_date,
        v_uid
      );

      IF NULLIF(v_split->>'recipient_user_id','') IS NOT NULL
         AND COALESCE(NULLIF(v_split->>'amount','')::numeric, 0) > 0 THEN
        INSERT INTO public.commission_payments (
          commission_id, booking_id, user_id, amount, paid_date, notes
        )
        SELECT
          c.id, c.booking_id,
          (v_split->>'recipient_user_id')::uuid,
          (v_split->>'amount')::numeric,
          v_paid_date,
          COALESCE(v_split->>'notes', 'Split payout')
        FROM public.commissions c WHERE c.id = v_commission_id;
      END IF;
    END LOOP;

    -- Mark parent commission paid
    UPDATE public.commissions
    SET status = 'paid', paid_date = v_paid_date, updated_at = now()
    WHERE id = v_commission_id;

    v_confirmed := v_confirmed + 1;
  END LOOP;

  -- Audit log
  BEGIN
    INSERT INTO public.bookkeeper_audit_log (user_id, action, resource, metadata)
    VALUES (v_uid, 'confirm_payout', 'commission_splits',
            jsonb_build_object('confirmed_count', v_confirmed));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('confirmed', v_confirmed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_commission_payout(jsonb) TO authenticated;
