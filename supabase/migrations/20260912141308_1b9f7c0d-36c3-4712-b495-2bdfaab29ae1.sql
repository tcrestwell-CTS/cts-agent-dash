CREATE TABLE public.ctn_approval_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid,
  email text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('invite', 'existing_user', 'docs_only', 'payment_pending')),
  source text NOT NULL DEFAULT 'ctn-approve',
  stripe_event_id text,
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_subscription_id text,
  payment_status text,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded', 'failed', 'pending_payment')),
  match_method text,
  invitation_id uuid REFERENCES public.invitations(id) ON DELETE SET NULL,
  agent_user_id uuid,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  error text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ctn_approval_log TO authenticated;
GRANT ALL ON public.ctn_approval_log TO service_role;
ALTER TABLE public.ctn_approval_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view CTN approval history"
ON public.ctn_approval_log
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));
CREATE UNIQUE INDEX ctn_approval_log_stripe_event_uidx
  ON public.ctn_approval_log (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;
CREATE UNIQUE INDEX ctn_approval_log_application_subscription_uidx
  ON public.ctn_approval_log (application_id, stripe_subscription_id, action_type)
  WHERE application_id IS NOT NULL AND stripe_subscription_id IS NOT NULL;
CREATE INDEX ctn_approval_log_unresolved_idx
  ON public.ctn_approval_log (status, updated_at)
  WHERE status IN ('processing', 'failed', 'pending_payment');
CREATE TRIGGER update_ctn_approval_log_updated_at
  BEFORE UPDATE ON public.ctn_approval_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();