CREATE UNIQUE INDEX IF NOT EXISTS agent_subscription_payments_stripe_pi_key
  ON public.agent_subscription_payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;