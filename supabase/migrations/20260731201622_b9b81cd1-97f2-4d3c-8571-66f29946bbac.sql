DROP VIEW IF EXISTS public.bookkeeper_clients_view;
DROP VIEW IF EXISTS public.bookkeeper_suppliers_view;
DROP VIEW IF EXISTS public.bookkeeper_profiles_view;

CREATE VIEW public.bookkeeper_clients_view AS
SELECT c.id, c.user_id, c.name, c.first_name, c.last_name, c.email, c.created_at
FROM public.clients c
WHERE public.is_bookkeeper(auth.uid())
   OR public.is_recon_admin()
   OR c.user_id = auth.uid();

CREATE VIEW public.bookkeeper_suppliers_view AS
SELECT s.id, s.user_id, s.name, s.contact_email, s.created_at
FROM public.suppliers s
WHERE auth.uid() IS NOT NULL;

CREATE VIEW public.bookkeeper_profiles_view AS
SELECT p.id, p.user_id, p.full_name, p.commission_tier, p.created_at
FROM public.profiles p
WHERE auth.uid() IS NOT NULL;

ALTER VIEW public.bookkeeper_clients_view   SET (security_invoker = false);
ALTER VIEW public.bookkeeper_suppliers_view SET (security_invoker = false);
ALTER VIEW public.bookkeeper_profiles_view  SET (security_invoker = false);

GRANT SELECT ON public.bookkeeper_clients_view   TO authenticated, service_role;
GRANT SELECT ON public.bookkeeper_suppliers_view TO authenticated, service_role;
GRANT SELECT ON public.bookkeeper_profiles_view  TO authenticated, service_role;

DROP POLICY IF EXISTS "Bookkeepers can view clients (limited via view)"   ON public.clients;
DROP POLICY IF EXISTS "Bookkeepers can view profiles (limited via view)"  ON public.profiles;
DROP POLICY IF EXISTS "Bookkeepers can view suppliers (limited via view)" ON public.suppliers;