ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS date_of_birth date;

UPDATE profiles SET date_of_birth = '1989-03-23' WHERE storefront_slug = 'crownledgertravel';
UPDATE profiles SET date_of_birth = '1982-08-25' WHERE storefront_slug = 'candotravel';
UPDATE profiles SET date_of_birth = '1969-05-18' WHERE storefront_slug = 'journey2safetravel';
UPDATE profiles SET date_of_birth = '1975-04-20' WHERE storefront_slug = 'robertstraveladventures';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;