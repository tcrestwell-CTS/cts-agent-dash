GRANT EXECUTE ON FUNCTION public.audit_account_integrity() TO service_role;
GRANT EXECUTE ON FUNCTION public.repair_account_integrity() TO service_role;
GRANT EXECUTE ON FUNCTION public.recalc_trip_payment_rollup(uuid) TO service_role;