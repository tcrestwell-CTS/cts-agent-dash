UPDATE public.trips SET status = 'booked', updated_at = now()
WHERE status = 'inbound'
  AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.trip_id = trips.id);