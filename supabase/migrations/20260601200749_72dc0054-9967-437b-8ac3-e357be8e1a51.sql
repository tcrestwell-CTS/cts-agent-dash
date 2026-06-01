-- 1) qbo_connections: revoke column-level access to tokens from authenticated/anon.
--    Edge functions use the service_role and bypass RLS / column grants, so
--    server-side flows are unaffected. Client code never reads these columns.
REVOKE SELECT (access_token, refresh_token) ON public.qbo_connections FROM authenticated;
REVOKE UPDATE (access_token, refresh_token) ON public.qbo_connections FROM authenticated;
REVOKE INSERT (access_token, refresh_token) ON public.qbo_connections FROM authenticated;

-- (anon was never granted on this table, but be defensive)
DO $$ BEGIN
  EXECUTE 'REVOKE ALL (access_token, refresh_token) ON public.qbo_connections FROM anon';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2) agent_payout_accounts: hide raw bank credentials from clients.
--    Owners still see last4 + metadata via the existing SELECT policy.
--    Admins who need full numbers should retrieve them through a server-side
--    edge function using service_role.
REVOKE SELECT (account_number, routing_number) ON public.agent_payout_accounts FROM authenticated;
REVOKE UPDATE (account_number, routing_number) ON public.agent_payout_accounts FROM authenticated;
-- INSERT is required so agents can submit their own number; trigger captures last4 then we'll add a clear-on-store trigger below.
DO $$ BEGIN
  EXECUTE 'REVOKE ALL (account_number, routing_number) ON public.agent_payout_accounts FROM anon';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3) checkout_payments.stripe_client_secret: clear once payment reaches a
--    terminal/captured state. The secret is only useful pre-confirmation.
CREATE OR REPLACE FUNCTION public.clear_stripe_client_secret_on_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('succeeded','paid','completed','captured','failed','canceled','cancelled') THEN
    NEW.stripe_client_secret := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clear_stripe_client_secret_trigger ON public.checkout_payments;
CREATE TRIGGER clear_stripe_client_secret_trigger
BEFORE UPDATE ON public.checkout_payments
FOR EACH ROW
EXECUTE FUNCTION public.clear_stripe_client_secret_on_terminal();

-- Backfill: clear secrets on already-terminal rows
UPDATE public.checkout_payments
SET stripe_client_secret = NULL
WHERE stripe_client_secret IS NOT NULL
  AND status IN ('succeeded','paid','completed','captured','failed','canceled','cancelled');

-- Also revoke column-level read of stripe_client_secret from anon/authenticated.
-- Only the originating checkout client needs it, and they get it directly from the
-- edge function response (not by querying the table).
DO $$ BEGIN
  EXECUTE 'REVOKE SELECT (stripe_client_secret) ON public.checkout_payments FROM authenticated';
  EXECUTE 'REVOKE SELECT (stripe_client_secret) ON public.checkout_payments FROM anon';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4) agent_messages: tighten the team channel so only admins / office_admins
--    can read internal team broadcasts. DMs remain unchanged (sender/recipient only).
DROP POLICY IF EXISTS "Staff can read team messages" ON public.agent_messages;
CREATE POLICY "Managers can read team messages"
ON public.agent_messages
FOR SELECT
TO authenticated
USING (
  channel = 'team'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  )
);

-- Restrict who can broadcast to the team channel as well (admins/office_admins only).
DROP POLICY IF EXISTS "Users can send messages" ON public.agent_messages;
CREATE POLICY "Users can send DMs"
ON public.agent_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND (
    channel = 'dm'
    OR (
      channel = 'team'
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'office_admin'::app_role)
      )
    )
  )
);