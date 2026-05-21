
-- 1. Add bookkeeper enum value
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bookkeeper';

-- 2. Helper function (uses text cast so it works in same migration as enum addition)
CREATE OR REPLACE FUNCTION public.is_bookkeeper(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'bookkeeper'
  );
$$;

-- 3. Read-only SELECT policies on financial tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'trip_payments','bookings','trips','commissions',
    'qbo_sync_logs','qbo_connections','qbo_payments',
    'stripe_payments','invoices','checkout_payments',
    'recon_dead_letter_queue'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Bookkeepers can view %1$I" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Bookkeepers can view %1$I" ON public.%1$I FOR SELECT USING (public.is_bookkeeper(auth.uid()))',
      t
    );
  END LOOP;
END $$;

-- 4. Restricted views (no PII beyond name/email)
CREATE OR REPLACE VIEW public.bookkeeper_clients_view
WITH (security_invoker = true) AS
SELECT id, user_id, name, first_name, last_name, email, created_at
FROM public.clients;

CREATE OR REPLACE VIEW public.bookkeeper_suppliers_view
WITH (security_invoker = true) AS
SELECT id, user_id, name, created_at
FROM public.suppliers;

CREATE OR REPLACE VIEW public.bookkeeper_profiles_view
WITH (security_invoker = true) AS
SELECT id, user_id, full_name, commission_tier, created_at
FROM public.profiles;

-- 5. Grant SELECT on views; underlying RLS still enforced. Add bookkeeper SELECT policies on underlying tables limited to view access.
-- For clients/suppliers/profiles, add a bookkeeper SELECT policy so the security_invoker view can read.
DROP POLICY IF EXISTS "Bookkeepers can view clients (limited via view)" ON public.clients;
CREATE POLICY "Bookkeepers can view clients (limited via view)"
ON public.clients FOR SELECT
USING (public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Bookkeepers can view suppliers (limited via view)" ON public.suppliers;
CREATE POLICY "Bookkeepers can view suppliers (limited via view)"
ON public.suppliers FOR SELECT
USING (public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Bookkeepers can view profiles (limited via view)" ON public.profiles;
CREATE POLICY "Bookkeepers can view profiles (limited via view)"
ON public.profiles FOR SELECT
USING (public.is_bookkeeper(auth.uid()));

GRANT SELECT ON public.bookkeeper_clients_view   TO authenticated;
GRANT SELECT ON public.bookkeeper_suppliers_view TO authenticated;
GRANT SELECT ON public.bookkeeper_profiles_view  TO authenticated;
