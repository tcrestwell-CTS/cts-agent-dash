alter table public.itinerary_items
  add column if not exists image_url text,
  add column if not exists thumbnail_url text,
  add column if not exists flight_status text;