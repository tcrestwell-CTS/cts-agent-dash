-- Crestwell lead pipeline + attribution columns.
-- Additive only: no existing column is changed or dropped.
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'new_lead',
  ADD COLUMN IF NOT EXISTS booking_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS landing_page text,
  ADD COLUMN IF NOT EXISTS referrer text;

ALTER TABLE public.quote_requests DROP CONSTRAINT IF EXISTS quote_requests_pipeline_stage_check;
ALTER TABLE public.quote_requests DROP CONSTRAINT IF EXISTS quote_requests_lost_reason_check;

-- Backfill before adding validation, so closed leads can become lost safely.
UPDATE public.quote_requests SET pipeline_stage = CASE
  WHEN status = 'booked' OR converted_trip_id IS NOT NULL THEN 'booked'
  WHEN status = 'closed' THEN 'lost'
  WHEN proposal_sent_at IS NOT NULL OR proposal_status IN ('sent','quote_sent') THEN 'quote_sent'
  WHEN status = 'qualified' THEN 'qualified'
  WHEN status = 'contacted' THEN 'contacted'
  ELSE 'new_lead' END;
UPDATE public.quote_requests SET lost_reason = 'Not recorded (backfill)', lost_at = now()
  WHERE pipeline_stage = 'lost' AND lost_reason IS NULL;

UPDATE public.quote_requests
  SET landing_page = raw_answers->>'landing_page', referrer = raw_answers->>'referrer'
  WHERE raw_answers ? 'landing_page' AND landing_page IS NULL;

ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_pipeline_stage_check
  CHECK (pipeline_stage IN ('new_lead','contacted','qualified','quote_sent','follow_up','booked','lost'));
ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_lost_reason_check
  CHECK (pipeline_stage <> 'lost' OR lost_reason IS NOT NULL);
CREATE INDEX IF NOT EXISTS quote_requests_pipeline_stage_idx ON public.quote_requests (pipeline_stage);