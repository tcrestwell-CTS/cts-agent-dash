-- Retag records imported via the Tern importer that were inadvertently saved with source='native'.
-- Matches the burst window from the actual import on 2026-04-25 ~12:48 UTC.
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
