UPDATE public.branding_settings SET agency_name = 'Journey 2 Safe Travel', email_address = COALESCE(NULLIF(email_address,''), NULL) WHERE user_id = 'cd8b0a78-8a5c-49fa-afdd-b1d2539ca82f';
UPDATE public.branding_settings b SET agency_name = p.agency_name
FROM public.profiles p
WHERE p.user_id = b.user_id AND b.agency_name = 'Crestwell Travel Services'
  AND p.agency_name IS NOT NULL AND p.agency_name <> '' AND p.agency_name NOT ILIKE 'Crestwell Travel Services%';