DELETE FROM public.branding_settings
WHERE user_id = '122757fd-e24a-459e-9f47-1c6e3238736e';

INSERT INTO public.branding_settings (user_id, agency_name, logo_url, email_address, phone, from_name)
SELECT p.user_id,
       COALESCE(NULLIF(p.agency_name, ''), p.full_name),
       NULLIF(p.storefront_logo_url, ''),
       NULLIF(p.storefront_email, ''),
       NULLIF(p.phone, ''),
       COALESCE(NULLIF(p.agency_name, ''), p.full_name)
FROM public.profiles p
WHERE p.user_id IN (
  '7f71ae85-2b94-4783-9d94-4cb19cd7f53c',
  'ba04b43e-a795-47bf-9416-9835e60459cf',
  '0cf54eeb-3bff-4f40-99cb-ae7c2154927e',
  '28b6ea88-f54b-4723-a6d3-06f5e6f620de',
  'e63344e7-bb11-4a76-bcc7-2b18b8e8f576',
  '853a12b9-976f-4b51-8dbe-1be82922ef6b'
)
AND NOT EXISTS (
  SELECT 1 FROM public.branding_settings b WHERE b.user_id = p.user_id
);