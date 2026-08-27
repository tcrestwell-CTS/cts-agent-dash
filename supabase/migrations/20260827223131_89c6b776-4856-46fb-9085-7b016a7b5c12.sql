ALTER TABLE public.checkout_payments REPLICA IDENTITY FULL;
ALTER TABLE public.trip_payments REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='checkout_payments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.checkout_payments;
  END IF;
END $$;