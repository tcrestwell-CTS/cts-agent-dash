ALTER TABLE public.ratehawk_orders
  ADD COLUMN IF NOT EXISTS rh_error_code text,
  ADD COLUMN IF NOT EXISTS error_stage text,
  ADD COLUMN IF NOT EXISTS error_retryable boolean,
  ADD COLUMN IF NOT EXISTS advisor_message text,
  ADD COLUMN IF NOT EXISTS form_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_partner_order_ids text[] NOT NULL DEFAULT '{}';