-- issued_cards
ALTER TABLE public.issued_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage issued cards" ON public.issued_cards;
CREATE POLICY "Admins manage issued cards" ON public.issued_cards
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
DROP POLICY IF EXISTS "Service role manages issued cards" ON public.issued_cards;
CREATE POLICY "Service role manages issued cards" ON public.issued_cards
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- viator_bookings
ALTER TABLE public.viator_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage viator bookings" ON public.viator_bookings;
CREATE POLICY "Staff manage viator bookings" ON public.viator_bookings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
DROP POLICY IF EXISTS "Service role manages viator bookings" ON public.viator_bookings;
CREATE POLICY "Service role manages viator bookings" ON public.viator_bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- secure_links (created_by is text)
ALTER TABLE public.secure_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon can select secure_links by token" ON public.secure_links;
DROP POLICY IF EXISTS "Anon can update secure_links" ON public.secure_links;
DROP POLICY IF EXISTS "Staff manage secure links" ON public.secure_links;
CREATE POLICY "Staff manage secure links" ON public.secure_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin') OR auth.uid()::text = created_by)
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin') OR auth.uid()::text = created_by);
DROP POLICY IF EXISTS "Service role manages secure links" ON public.secure_links;
CREATE POLICY "Service role manages secure links" ON public.secure_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- loan_applications
DROP POLICY IF EXISTS "anon_read_loan_applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Authenticated can manage loan applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Authenticated users can manage loan applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Staff manage loan applications" ON public.loan_applications;
CREATE POLICY "Staff manage loan applications" ON public.loan_applications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

-- loan_payment_schedules
DROP POLICY IF EXISTS "Authenticated users can manage loan payment schedules" ON public.loan_payment_schedules;
DROP POLICY IF EXISTS "Owners can view loan payment schedules" ON public.loan_payment_schedules;
DROP POLICY IF EXISTS "Staff manage loan payment schedules" ON public.loan_payment_schedules;
CREATE POLICY "Owners can view loan payment schedules" ON public.loan_payment_schedules
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Staff manage loan payment schedules" ON public.loan_payment_schedules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

-- campaigns
DROP POLICY IF EXISTS "auth full access campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Owners and staff manage campaigns" ON public.campaigns;
CREATE POLICY "Owners and staff manage campaigns" ON public.campaigns
  FOR ALL TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

-- campaign_recipients
DROP POLICY IF EXISTS "auth full access recipients" ON public.campaign_recipients;
DROP POLICY IF EXISTS "Owners and staff manage recipients" ON public.campaign_recipients;
CREATE POLICY "Owners and staff manage recipients" ON public.campaign_recipients
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office_admin')
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_recipients.campaign_id AND c.created_by = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'office_admin')
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_recipients.campaign_id AND c.created_by = auth.uid())
  );

-- email_suppressions
DROP POLICY IF EXISTS "auth full access suppressions" ON public.email_suppressions;
DROP POLICY IF EXISTS "Staff manage suppressions" ON public.email_suppressions;
CREATE POLICY "Staff manage suppressions" ON public.email_suppressions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

-- featured_trips
DROP POLICY IF EXISTS "Authenticated users can manage featured trips" ON public.featured_trips;
DROP POLICY IF EXISTS "Staff manage featured trips" ON public.featured_trips;
CREATE POLICY "Staff manage featured trips" ON public.featured_trips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

-- marketing_image_assets
DROP POLICY IF EXISTS "Authenticated can delete marketing images" ON public.marketing_image_assets;
DROP POLICY IF EXISTS "Authenticated can update marketing images" ON public.marketing_image_assets;
DROP POLICY IF EXISTS "Authenticated can read marketing images" ON public.marketing_image_assets;
DROP POLICY IF EXISTS "Owners can update marketing images" ON public.marketing_image_assets;
DROP POLICY IF EXISTS "Owners can delete marketing images" ON public.marketing_image_assets;
CREATE POLICY "Authenticated can read marketing images" ON public.marketing_image_assets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Owners can update marketing images" ON public.marketing_image_assets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners can delete marketing images" ON public.marketing_image_assets
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- newsletter_subscribers
DROP POLICY IF EXISTS "Anyone can read newsletter subscriptions" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Anyone can update newsletter subscription" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Staff can read newsletter subscriptions" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Staff can update newsletter subscriptions" ON public.newsletter_subscribers;
CREATE POLICY "Staff can read newsletter subscriptions" ON public.newsletter_subscribers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));
CREATE POLICY "Staff can update newsletter subscriptions" ON public.newsletter_subscribers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

-- checkout_payments
DROP POLICY IF EXISTS "Public can create checkout payments" ON public.checkout_payments;
DROP POLICY IF EXISTS "Agents can create checkout payments" ON public.checkout_payments;
CREATE POLICY "Agents can create checkout payments" ON public.checkout_payments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = agent_user_id);

-- storage: cc-signatures bucket
DROP POLICY IF EXISTS "Users can upload cc signatures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cc signatures" ON storage.objects;
CREATE POLICY "Authenticated users can upload cc signatures" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cc-signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- blog_posts: enable RLS (policies exist)
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;