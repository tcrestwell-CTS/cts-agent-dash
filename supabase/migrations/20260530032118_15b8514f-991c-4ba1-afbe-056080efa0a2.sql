
ALTER TABLE public.payment_ip_logs
  ADD COLUMN IF NOT EXISTS page           TEXT,
  ADD COLUMN IF NOT EXISTS ip_address     TEXT,
  ADD COLUMN IF NOT EXISTS user_agent     TEXT,
  ADD COLUMN IF NOT EXISTS referer        TEXT,
  ADD COLUMN IF NOT EXISTS country        TEXT,
  ADD COLUMN IF NOT EXISTS amount_cents   INTEGER,
  ADD COLUMN IF NOT EXISTS currency       TEXT DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS stripe_pm_id   TEXT,
  ADD COLUMN IF NOT EXISTS last_four      TEXT,
  ADD COLUMN IF NOT EXISTS outcome        TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS flag_reason    TEXT;

GRANT INSERT ON public.payment_ip_logs TO anon;
GRANT SELECT ON public.payment_ip_logs TO authenticated;

DROP POLICY IF EXISTS "anon_insert_ip_logs" ON public.payment_ip_logs;
CREATE POLICY "anon_insert_ip_logs" ON public.payment_ip_logs
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "agent_read_ip_logs" ON public.payment_ip_logs;
CREATE POLICY "agent_read_ip_logs" ON public.payment_ip_logs
  FOR SELECT TO authenticated USING (true);
