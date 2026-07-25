
-- 1. Extend mentor_assignments
ALTER TABLE public.mentor_assignments
  ADD COLUMN IF NOT EXISTS split_percent numeric(5,2) NOT NULL DEFAULT 0
    CHECK (split_percent >= 0 AND split_percent <= 100),
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date;

-- 2. commission_splits table
CREATE TABLE IF NOT EXISTS public.commission_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('agent','mentor','house','custom')),
  percent numeric(5,2) CHECK (percent IS NULL OR (percent >= 0 AND percent <= 100)),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','paid')),
  notes text,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id),
  paid_date date,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_splits_commission_id ON public.commission_splits(commission_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_recipient ON public.commission_splits(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_status ON public.commission_splits(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_splits TO authenticated;
GRANT ALL ON public.commission_splits TO service_role;

ALTER TABLE public.commission_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all commission splits"
  ON public.commission_splits FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Recipients view own splits"
  ON public.commission_splits FOR SELECT
  TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Bookkeepers view all splits"
  ON public.commission_splits FOR SELECT
  TO authenticated
  USING (is_bookkeeper(auth.uid()));

CREATE TRIGGER trg_commission_splits_updated_at
  BEFORE UPDATE ON public.commission_splits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. confirm_commission_payout RPC
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
  IF NOT (has_role(v_uid, 'admin'::app_role) OR has_role(v_uid, 'office_admin'::app_role)) THEN
    RAISE EXCEPTION 'Unauthorized: admin or office_admin required';
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

      -- Create commission_payments record if recipient is set
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
