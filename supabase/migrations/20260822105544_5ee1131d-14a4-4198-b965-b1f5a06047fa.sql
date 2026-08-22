DROP INDEX IF EXISTS public.agent_subscription_payments_stripe_pi_key;
CREATE UNIQUE INDEX IF NOT EXISTS agent_subscription_payments_stripe_pi_key
  ON public.agent_subscription_payments (stripe_payment_intent_id);