REVOKE EXECUTE ON FUNCTION public.enforce_trip_publish_gate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_trip_publish_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trip_publish_readiness(uuid) TO authenticated;