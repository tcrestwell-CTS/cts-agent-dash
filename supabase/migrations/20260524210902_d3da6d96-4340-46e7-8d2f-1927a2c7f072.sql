
ALTER TABLE public.car_rental_requests
  ADD COLUMN IF NOT EXISTS quoted_price numeric,
  ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS cc_collection_method text,
  ADD COLUMN IF NOT EXISTS cc_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS cc_collected_by uuid,
  ADD COLUMN IF NOT EXISTS cc_full_collected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cc_stripe_pm_id text;

CREATE TABLE IF NOT EXISTS public.rental_payment_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  rental_id   uuid NOT NULL REFERENCES public.car_rental_requests(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used        boolean NOT NULL DEFAULT false,
  used_at     timestamptz
);

CREATE INDEX IF NOT EXISTS rental_payment_tokens_rental_idx ON public.rental_payment_tokens(rental_id);
CREATE INDEX IF NOT EXISTS rental_payment_tokens_token_idx  ON public.rental_payment_tokens(token);

ALTER TABLE public.rental_payment_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_full_access_rental_tokens"
  ON public.rental_payment_tokens FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_select_rental_tokens"
  ON public.rental_payment_tokens FOR SELECT
  TO anon USING (true);

CREATE POLICY "anon_update_rental_tokens"
  ON public.rental_payment_tokens FOR UPDATE
  TO anon USING (used = false AND expires_at > now())
  WITH CHECK (used = true);
