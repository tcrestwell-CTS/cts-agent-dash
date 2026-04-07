
-- Cabin/category options for group trips
CREATE TABLE public.trip_cabin_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  description TEXT,
  price_per_person NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC DEFAULT 0,
  capacity INTEGER,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add selected cabin reference to trips (for sub-trips)
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS selected_cabin_option_id UUID REFERENCES public.trip_cabin_options(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.trip_cabin_options ENABLE ROW LEVEL SECURITY;

-- RLS: trip owner can manage cabin options
CREATE POLICY "Users can view cabin options for their trips"
ON public.trip_cabin_options FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_cabin_options.trip_id AND trips.user_id = auth.uid())
);

CREATE POLICY "Users can create cabin options for their trips"
ON public.trip_cabin_options FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_cabin_options.trip_id AND trips.user_id = auth.uid())
);

CREATE POLICY "Users can update cabin options for their trips"
ON public.trip_cabin_options FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_cabin_options.trip_id AND trips.user_id = auth.uid())
);

CREATE POLICY "Users can delete cabin options for their trips"
ON public.trip_cabin_options FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_cabin_options.trip_id AND trips.user_id = auth.uid())
);

-- Anon users need to read cabin options for group landing pages
CREATE POLICY "Anon users can view cabin options for enabled landing pages"
ON public.trip_cabin_options FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.trips 
    WHERE trips.id = trip_cabin_options.trip_id 
    AND trips.group_landing_enabled = true
  )
);

-- Timestamp trigger
CREATE TRIGGER update_trip_cabin_options_updated_at
BEFORE UPDATE ON public.trip_cabin_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
