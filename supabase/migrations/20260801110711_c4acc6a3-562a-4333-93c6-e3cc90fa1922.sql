ALTER TABLE public.inbox_processed_messages
  ADD COLUMN IF NOT EXISTS body_text text,
  ADD COLUMN IF NOT EXISTS itinerary_imported_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_inbox_processed_trip_class
  ON public.inbox_processed_messages (linked_trip_id, classification, received_at DESC);