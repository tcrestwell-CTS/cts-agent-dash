-- payment_ip_logs: fraud/risk telemetry for payment attempts
CREATE TABLE public.payment_ip_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT,
  ip_address INET,
  user_agent TEXT,
  country TEXT,
  amount_cents INTEGER,
  currency TEXT DEFAULT 'usd',
  stripe_payment_method_id TEXT,
  stripe_payment_intent_id TEXT,
  outcome TEXT, -- e.g. 'succeeded','failed','requires_action','declined'
  risk_flags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  risk_score INTEGER NOT NULL DEFAULT 0,
  checkout_payment_id UUID,
  trip_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants (admin-only reads via RLS; webhooks/edge fns use service role)
GRANT SELECT ON public.payment_ip_logs TO authenticated;
GRANT ALL ON public.payment_ip_logs TO service_role;

-- Indexes
CREATE INDEX idx_payment_ip_logs_ip ON public.payment_ip_logs (ip_address);
CREATE INDEX idx_payment_ip_logs_email ON public.payment_ip_logs (lower(customer_email));
CREATE INDEX idx_payment_ip_logs_intent ON public.payment_ip_logs (stripe_payment_intent_id);
CREATE INDEX idx_payment_ip_logs_created_at ON public.payment_ip_logs (created_at DESC);
CREATE INDEX idx_payment_ip_logs_risk_flags ON public.payment_ip_logs USING GIN (risk_flags);

-- RLS
ALTER TABLE public.payment_ip_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view payment IP logs"
ON public.payment_ip_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
);

-- Auto risk-flag trigger
CREATE OR REPLACE FUNCTION public.payment_ip_logs_auto_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flags TEXT[] := COALESCE(NEW.risk_flags, ARRAY[]::TEXT[]);
  v_score INTEGER := COALESCE(NEW.risk_score, 0);
  v_ip_count INT;
  v_email_count INT;
BEGIN
  -- High-value attempt
  IF NEW.amount_cents IS NOT NULL AND NEW.amount_cents > 500000 THEN
    v_flags := array_append(v_flags, 'high_amount');
    v_score := v_score + 20;
  END IF;

  -- Missing geolocation
  IF NEW.country IS NULL OR length(trim(NEW.country)) = 0 THEN
    v_flags := array_append(v_flags, 'missing_country');
    v_score := v_score + 5;
  END IF;

  -- Same email from multiple IPs in 24h
  IF NEW.customer_email IS NOT NULL THEN
    SELECT COUNT(DISTINCT ip_address) INTO v_ip_count
    FROM public.payment_ip_logs
    WHERE lower(customer_email) = lower(NEW.customer_email)
      AND created_at > now() - interval '24 hours'
      AND ip_address IS NOT NULL
      AND (NEW.ip_address IS NULL OR ip_address <> NEW.ip_address);
    IF v_ip_count >= 2 THEN
      v_flags := array_append(v_flags, 'multi_ip_same_email');
      v_score := v_score + 25;
    END IF;
  END IF;

  -- Same IP from multiple emails in 24h
  IF NEW.ip_address IS NOT NULL THEN
    SELECT COUNT(DISTINCT lower(customer_email)) INTO v_email_count
    FROM public.payment_ip_logs
    WHERE ip_address = NEW.ip_address
      AND created_at > now() - interval '24 hours'
      AND customer_email IS NOT NULL
      AND (NEW.customer_email IS NULL OR lower(customer_email) <> lower(NEW.customer_email));
    IF v_email_count >= 2 THEN
      v_flags := array_append(v_flags, 'multi_email_same_ip');
      v_score := v_score + 30;
    END IF;
  END IF;

  -- Failed outcome
  IF NEW.outcome IN ('failed', 'declined') THEN
    v_flags := array_append(v_flags, 'declined');
    v_score := v_score + 10;
  END IF;

  NEW.risk_flags := v_flags;
  NEW.risk_score := v_score;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_ip_logs_auto_flag
BEFORE INSERT ON public.payment_ip_logs
FOR EACH ROW
EXECUTE FUNCTION public.payment_ip_logs_auto_flag();