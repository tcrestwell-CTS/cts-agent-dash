-- lovable-cron-fallback-reviewed: RateHawk has no webhook for finish status; job is armed on enqueue (trigger) and unscheduled after drain
CREATE OR REPLACE FUNCTION public.ratehawk_sweep_arm()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, cron AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ratehawk-status-sweep') THEN RETURN; END IF;
  PERFORM cron.schedule('ratehawk-status-sweep', '*/3 * * * *', $cmd$
    select net.http_post(
      url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/ratehawk',
      headers := jsonb_build_object('Content-Type','application/json',
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpidG51bHp2d3JlcXpibXh1bHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjkzMjksImV4cCI6MjA4NjAwNTMyOX0.0PJACAXw8c8ik3_UBpBEGWXBxfLbMxh3jP1brMCCpGU',
        'x-cron-token', (select token from private.cron_tokens where name = 'ratehawk_status_sweep')),
      body := '{}'::jsonb);
  $cmd$);
END; $$;

CREATE OR REPLACE FUNCTION public.ratehawk_sweep_disarm_if_idle()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ratehawk_orders WHERE status IN ('processing','finishing')) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ratehawk-status-sweep') THEN
    PERFORM cron.unschedule('ratehawk-status-sweep');
  END IF;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.ratehawk_sweep_arm() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ratehawk_sweep_disarm_if_idle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ratehawk_sweep_disarm_if_idle() TO service_role;

CREATE OR REPLACE FUNCTION public.trg_ratehawk_arm_sweep()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('processing','finishing')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.ratehawk_sweep_arm();
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.trg_ratehawk_arm_sweep() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ratehawk_arm_sweep ON public.ratehawk_orders;
CREATE TRIGGER ratehawk_arm_sweep AFTER INSERT OR UPDATE OF status ON public.ratehawk_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_ratehawk_arm_sweep();

-- Arm now if anything is already stuck.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.ratehawk_orders WHERE status IN ('processing','finishing')) THEN
    PERFORM public.ratehawk_sweep_arm();
  END IF;
END $$;