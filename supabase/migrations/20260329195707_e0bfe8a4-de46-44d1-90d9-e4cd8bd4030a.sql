
-- Trip nurture steps table for Agent 4 (CHRIS)
CREATE TABLE IF NOT EXISTS public.trip_nurture_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  resend_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient cron queries
CREATE INDEX idx_nurture_steps_pending ON public.trip_nurture_steps (status, scheduled_at)
  WHERE status = 'pending';

-- RLS
ALTER TABLE public.trip_nurture_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nurture steps"
  ON public.trip_nurture_steps FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own nurture steps"
  ON public.trip_nurture_steps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own nurture steps"
  ON public.trip_nurture_steps FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Service role needs full access for the edge function
CREATE POLICY "Service role full access nurture steps"
  ON public.trip_nurture_steps FOR ALL
  USING (true) WITH CHECK (true);

-- Add nurture tracking columns to trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS nurture_started boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nurture_paused boolean DEFAULT false;

-- Trigger: when trip moves to 'booked', invoke chris edge function
CREATE OR REPLACE FUNCTION public.notify_chris_booked()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  _service_key text;
BEGIN
  IF (NEW.status = 'booked' AND (OLD.status IS DISTINCT FROM 'booked')) THEN
    SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;

    PERFORM net.http_post(
      url     := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/chris',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body    := jsonb_build_object('trip_id', NEW.id),
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_chris_on_booked ON public.trips;
CREATE TRIGGER trigger_chris_on_booked
  AFTER UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chris_booked();
