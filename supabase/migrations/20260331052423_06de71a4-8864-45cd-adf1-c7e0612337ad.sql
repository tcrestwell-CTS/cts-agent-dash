
-- Table to track Duffel flight orders for monitoring
CREATE TABLE public.flight_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  duffel_order_id TEXT NOT NULL UNIQUE,
  booking_reference TEXT,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  passenger_names TEXT[],
  passenger_emails TEXT[],
  origin_iata TEXT,
  destination_iata TEXT,
  departure_at TIMESTAMPTZ,
  arrival_at TIMESTAMPTZ,
  airline_name TEXT,
  flight_numbers TEXT[],
  total_amount NUMERIC DEFAULT 0,
  total_currency TEXT DEFAULT 'USD',
  order_status TEXT DEFAULT 'confirmed',
  last_event_type TEXT,
  last_event_at TIMESTAMPTZ,
  event_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flight_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flight orders"
  ON public.flight_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own flight orders"
  ON public.flight_orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own flight orders"
  ON public.flight_orders FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Service role needs full access for webhook processing
CREATE POLICY "Service role full access"
  ON public.flight_orders FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Trigger to update updated_at
CREATE TRIGGER flight_orders_updated_at
  BEFORE UPDATE ON public.flight_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for flight status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.flight_orders;
