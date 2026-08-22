CREATE TABLE public.agent_subscription_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_user_id uuid NOT NULL,
  plan_name text,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  period_start date,
  period_end date,
  payment_method text NOT NULL DEFAULT 'stripe',
  status text NOT NULL DEFAULT 'paid',
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  stripe_fee numeric NOT NULL DEFAULT 0,
  notes text,
  qbo_deposit_id text,
  qbo_synced_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX agent_subscription_payments_pi_uniq
  ON public.agent_subscription_payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX agent_subscription_payments_date_idx ON public.agent_subscription_payments (payment_date DESC);
CREATE INDEX agent_subscription_payments_agent_idx ON public.agent_subscription_payments (agent_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_subscription_payments TO authenticated;
GRANT ALL ON public.agent_subscription_payments TO service_role;

ALTER TABLE public.agent_subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Back office can manage advisor subscription payments"
ON public.agent_subscription_payments FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
  OR public.has_role(auth.uid(), 'bookkeeper'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
  OR public.has_role(auth.uid(), 'bookkeeper'::app_role)
);

CREATE POLICY "Advisors can view their own subscription payments"
ON public.agent_subscription_payments FOR SELECT TO authenticated
USING (agent_user_id = auth.uid());

CREATE TRIGGER update_agent_subscription_payments_updated_at
BEFORE UPDATE ON public.agent_subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.trigger_qbo_agent_subscription_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid')
     AND NEW.qbo_deposit_id IS NULL THEN
    PERFORM public._post_qbo_sync_trigger('agent_subscription_received', row_to_json(NEW)::jsonb, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER qbo_agent_subscription_received
AFTER INSERT OR UPDATE OF status ON public.agent_subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.trigger_qbo_agent_subscription_received();