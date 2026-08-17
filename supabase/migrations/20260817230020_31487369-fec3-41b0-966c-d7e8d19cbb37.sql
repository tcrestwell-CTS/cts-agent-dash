ALTER TABLE public.secure_links
ADD COLUMN IF NOT EXISTS agent_user_id uuid,
ADD COLUMN IF NOT EXISTS trip_payment_id uuid REFERENCES public.trip_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_secure_links_agent_user_id ON public.secure_links(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_secure_links_trip_payment_id ON public.secure_links(trip_payment_id);