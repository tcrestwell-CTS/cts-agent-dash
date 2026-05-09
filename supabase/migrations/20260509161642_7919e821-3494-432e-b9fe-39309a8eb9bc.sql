DO $$
DECLARE
  v_parent_trip_id uuid := '85a455bc-22cb-4b03-8a7a-941aaa400477';
  v_sub_trip_id    uuid := 'b570d4b5-4851-419e-b68b-96a4fca8ef40';
  v_cabin_id       uuid;
BEGIN
  INSERT INTO public.trip_cabin_options
    (trip_id, category_name, description, price_per_person, deposit_amount, capacity, sort_order)
  SELECT v_parent_trip_id,
         'Mega Rockstar Suite',
         'Top-tier Virgin Voyages RockStar Suite — expansive layout with premium perks and exclusive access.',
         4100,
         1553.20,
         2,
         0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.trip_cabin_options
    WHERE trip_id = v_parent_trip_id AND category_name = 'Mega Rockstar Suite'
  );

  INSERT INTO public.trip_cabin_options
    (trip_id, category_name, description, price_per_person, deposit_amount, capacity, sort_order)
  SELECT v_sub_trip_id,
         'Mega Rockstar Suite',
         'Top-tier Virgin Voyages RockStar Suite — expansive layout with premium perks and exclusive access.',
         4100,
         1553.20,
         2,
         0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.trip_cabin_options
    WHERE trip_id = v_sub_trip_id AND category_name = 'Mega Rockstar Suite'
  );

  UPDATE public.trips
  SET selected_cabin_option_id = (
    SELECT id FROM public.trip_cabin_options
    WHERE trip_id = v_sub_trip_id AND category_name = 'Mega Rockstar Suite'
    LIMIT 1
  )
  WHERE id = v_sub_trip_id;
END $$;