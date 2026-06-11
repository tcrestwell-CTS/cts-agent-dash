
-- 1. Allow agents to read their own checkout_payments rows
CREATE POLICY "Agents can view their own checkout payments"
  ON public.checkout_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_user_id);

-- 2. Remove permissive agent SELECT policy that exposed raw portal session tokens
DROP POLICY IF EXISTS "Agents can view portal sessions for their clients" ON public.client_portal_sessions;

-- 3. Allow service role to delete expired signup verification codes
CREATE POLICY "Service role can delete signup verification codes"
  ON public.signup_verification_codes
  FOR DELETE
  TO service_role
  USING (true);
