CREATE OR REPLACE FUNCTION public.expire_cc_auth_on_paid_in_full()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disabled: CC authorizations must stay open for their full 30-day window
  -- regardless of booking payment status. The 30-day expiry job still applies.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.expire_cc_auth_on_paid_in_full() IS 'DISABLED: no longer closes CC authorizations on paid-in-full; kept as no-op so the existing trigger remains valid.';