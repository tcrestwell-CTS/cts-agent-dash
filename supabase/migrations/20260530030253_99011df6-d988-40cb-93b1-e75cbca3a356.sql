-- Add columns to align payment_ip_logs with app spec
ALTER TABLE public.payment_ip_logs
  ADD COLUMN IF NOT EXISTS page TEXT,
  ADD COLUMN IF NOT EXISTS last_four TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID,
  ADD COLUMN IF NOT EXISTS booking_id UUID;

-- Generated convenience column for UI
ALTER TABLE public.payment_ip_logs
  ADD COLUMN IF NOT EXISTS flagged BOOLEAN
    GENERATED ALWAYS AS (COALESCE(array_length(risk_flags, 1), 0) > 0) STORED;

CREATE INDEX IF NOT EXISTS idx_payment_ip_logs_page ON public.payment_ip_logs(page);
CREATE INDEX IF NOT EXISTS idx_payment_ip_logs_client ON public.payment_ip_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_ip_logs_booking ON public.payment_ip_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_ip_logs_flagged ON public.payment_ip_logs(flagged) WHERE flagged = true;