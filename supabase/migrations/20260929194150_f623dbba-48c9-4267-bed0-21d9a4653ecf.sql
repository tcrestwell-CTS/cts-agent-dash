ALTER TABLE public.ratehawk_orders
  ADD COLUMN IF NOT EXISTS processing_since timestamptz,
  ADD COLUMN IF NOT EXISTS status_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_check_lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS auto_status_checks integer NOT NULL DEFAULT 0;

UPDATE public.ratehawk_orders SET processing_since = updated_at
 WHERE status IN ('processing','finishing') AND processing_since IS NULL;

CREATE INDEX IF NOT EXISTS idx_rh_orders_processing ON public.ratehawk_orders (status, updated_at)
 WHERE status IN ('processing','finishing');

-- Atomic lease: only one status check per order at a time.
CREATE OR REPLACE FUNCTION public.claim_ratehawk_status_check(p_order_id uuid, p_lease_seconds integer)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    UPDATE public.ratehawk_orders
       SET status_check_lock_until = now() + make_interval(secs => p_lease_seconds),
           status_checked_at = now(),
           processing_since = COALESCE(processing_since, now())
     WHERE id = p_order_id
       AND (status_check_lock_until IS NULL OR status_check_lock_until < now())
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM c);
$$;
CREATE OR REPLACE FUNCTION public.release_ratehawk_status_check(p_order_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ratehawk_orders SET status_check_lock_until = NULL WHERE id = p_order_id;
$$;
REVOKE ALL ON FUNCTION public.claim_ratehawk_status_check(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_ratehawk_status_check(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ratehawk_status_check(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ratehawk_status_check(uuid) TO service_role;

-- Private scheduler token (not exposed via the API).
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.cron_tokens (name) VALUES ('ratehawk_status_sweep') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_token(p_name text, p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM private.cron_tokens WHERE name = p_name AND token = p_token AND length(p_token) > 0);
$$;
REVOKE ALL ON FUNCTION public.verify_cron_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_token(text, text) TO service_role;