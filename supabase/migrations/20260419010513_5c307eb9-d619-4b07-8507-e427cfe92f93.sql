CREATE OR REPLACE FUNCTION public.reveal_cw_agent_secret()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  -- Restrict to admins only
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'CW_AGENT_SECRET'
  LIMIT 1;

  RETURN v_secret;
END;
$$;