UPDATE public.trip_payments tp SET user_id = t.user_id, updated_at = now()
FROM public.trips t WHERE t.id = tp.trip_id AND tp.user_id <> t.user_id;

UPDATE public.bookings b SET user_id = t.user_id, updated_at = now()
FROM public.trips t WHERE t.id = b.trip_id AND b.user_id <> t.user_id;