-- Tighten over-permissive RLS on financial / reconciliation / Stripe / QBO tables.
DROP POLICY IF EXISTS "Staff can read QBO accounts"       ON public.qbo_accounts;
CREATE POLICY "Admins and bookkeepers read QBO accounts"
  ON public.qbo_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read QBO bills"          ON public.qbo_bills;
CREATE POLICY "Admins and bookkeepers read QBO bills"
  ON public.qbo_bills FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read QBO bill payments"  ON public.qbo_bill_payments;
CREATE POLICY "Admins and bookkeepers read QBO bill payments"
  ON public.qbo_bill_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read QBO customers"      ON public.qbo_customers;
CREATE POLICY "Admins and bookkeepers read QBO customers"
  ON public.qbo_customers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read QBO deposits"       ON public.qbo_deposits;
CREATE POLICY "Admins and bookkeepers read QBO deposits"
  ON public.qbo_deposits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read QBO invoices"       ON public.qbo_invoices;
CREATE POLICY "Admins and bookkeepers read QBO invoices"
  ON public.qbo_invoices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read QBO payments"       ON public.qbo_payments;
CREATE POLICY "Admins and bookkeepers read QBO payments"
  ON public.qbo_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read QBO vendors"        ON public.qbo_vendors;
CREATE POLICY "Admins and bookkeepers read QBO vendors"
  ON public.qbo_vendors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read account config"     ON public.recon_account_config;
CREATE POLICY "Admins and bookkeepers read account config"
  ON public.recon_account_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_recon_admin() OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read audit log"          ON public.recon_audit_log;
CREATE POLICY "Admins and bookkeepers read audit log"
  ON public.recon_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_recon_admin() OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read entity mappings"    ON public.recon_entity_mappings;
CREATE POLICY "Admins and bookkeepers read entity mappings"
  ON public.recon_entity_mappings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_recon_admin() OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read recon matches"      ON public.recon_matches;
CREATE POLICY "Admins and bookkeepers read recon matches"
  ON public.recon_matches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_recon_admin() OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read approval tasks"     ON public.approval_tasks;
CREATE POLICY "Admins and bookkeepers read approval tasks"
  ON public.approval_tasks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_recon_admin() OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can update approval tasks"   ON public.approval_tasks;
CREATE POLICY "Admins and recon admins update approval tasks"
  ON public.approval_tasks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_recon_admin())
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.is_recon_admin());

DROP POLICY IF EXISTS "Staff can read exceptions"         ON public.exception_queue;
CREATE POLICY "Admins and bookkeepers read exceptions"
  ON public.exception_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_recon_admin() OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can update exceptions"       ON public.exception_queue;
CREATE POLICY "Admins and recon admins update exceptions"
  ON public.exception_queue FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_recon_admin() OR public.is_bookkeeper(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.is_recon_admin() OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read stripe disputes"        ON public.stripe_disputes;
CREATE POLICY "Admins and bookkeepers read stripe disputes"
  ON public.stripe_disputes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read stripe payments"        ON public.stripe_payments;
CREATE POLICY "Admins and bookkeepers read stripe payments"
  ON public.stripe_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read stripe payouts"         ON public.stripe_payouts;
CREATE POLICY "Admins and bookkeepers read stripe payouts"
  ON public.stripe_payouts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read stripe payout payments" ON public.stripe_payout_payments;
CREATE POLICY "Admins and bookkeepers read stripe payout payments"
  ON public.stripe_payout_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read stripe refunds"         ON public.stripe_refunds;
CREATE POLICY "Admins and bookkeepers read stripe refunds"
  ON public.stripe_refunds FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.is_bookkeeper(auth.uid()));

DROP POLICY IF EXISTS "Staff can read stripe webhook events"  ON public.stripe_webhook_events;
CREATE POLICY "Admins read stripe webhook events"
  ON public.stripe_webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

-- Storage: tighten email-assets writes to folder owner
DROP POLICY IF EXISTS "email-assets authenticated update" ON storage.objects;
CREATE POLICY "email-assets owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'email-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'email-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "email-assets authenticated delete" ON storage.objects;
CREATE POLICY "email-assets owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'email-assets'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(),'admin'::app_role)
    )
  );

-- Storage: trip-covers — bucket files live under `${trip_id}/...`
DROP POLICY IF EXISTS "Users can update trip covers" ON storage.objects;
CREATE POLICY "Trip owners update trip covers"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'trip-covers'
    AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'office_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'trip-covers'
    AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'office_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete trip covers" ON storage.objects;
CREATE POLICY "Trip owners delete trip covers"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'trip-covers'
    AND (
      public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'office_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.user_id = auth.uid()
      )
    )
  );