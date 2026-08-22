CREATE TABLE IF NOT EXISTS public.agent_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL UNIQUE,
  plan_name text NOT NULL DEFAULT 'Advisor Plan',
  plan_description text,
  amount numeric NOT NULL DEFAULT 0,
  billing_interval text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'active',
  started_on date,
  next_billing_date date,
  stripe_customer_id text,
  stripe_subscription_id text,
  payment_method_brand text,
  payment_method_last4 text,
  payment_method_exp text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_subscriptions TO authenticated;
GRANT ALL ON public.agent_subscriptions TO service_role;

ALTER TABLE public.agent_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Advisors read own subscription" ON public.agent_subscriptions;
CREATE POLICY "Advisors read own subscription"
  ON public.agent_subscriptions FOR SELECT TO authenticated
  USING (agent_user_id = auth.uid()
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'office_admin'::app_role)
     OR public.has_role(auth.uid(), 'bookkeeper'::app_role));

DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.agent_subscriptions;
CREATE POLICY "Admins manage subscriptions"
  ON public.agent_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));

DROP TRIGGER IF EXISTS agent_subscriptions_updated_at ON public.agent_subscriptions;
CREATE TRIGGER agent_subscriptions_updated_at
  BEFORE UPDATE ON public.agent_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();