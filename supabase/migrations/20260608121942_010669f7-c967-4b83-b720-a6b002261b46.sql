
ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS txtya_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS txtya_default_group_id text;

CREATE TABLE IF NOT EXISTS public.txtya_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  companion_id uuid REFERENCES public.client_companions(id) ON DELETE SET NULL,
  traveler_kind text NOT NULL CHECK (traveler_kind IN ('primary','companion')),
  txtya_traveler_id text,
  txtya_trip_id text,
  status text NOT NULL CHECK (status IN ('success','error','skipped')),
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.txtya_sync_log TO authenticated;
GRANT ALL ON public.txtya_sync_log TO service_role;

ALTER TABLE public.txtya_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view txtya sync log"
  ON public.txtya_sync_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'office_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_txtya_sync_log_trip ON public.txtya_sync_log(trip_id);
CREATE INDEX IF NOT EXISTS idx_txtya_sync_log_created ON public.txtya_sync_log(created_at DESC);
