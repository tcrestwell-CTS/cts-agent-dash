update public.clients
   set source = 'tern_import'
 where source = 'native'
   and created_at between '2026-04-25 12:48:00+00' and '2026-04-25 12:50:00+00';

update public.trips
   set source = 'tern_import'
 where source = 'native'
   and created_at between '2026-04-25 12:48:00+00' and '2026-04-25 12:50:00+00';

update public.bookings
   set source = 'tern_import'
 where source = 'native'
   and created_at between '2026-04-25 12:48:00+00' and '2026-04-25 12:50:00+00';