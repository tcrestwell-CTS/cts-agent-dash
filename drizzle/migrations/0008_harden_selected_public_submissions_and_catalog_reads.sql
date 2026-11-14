DROP POLICY "Public can submit loan applications" ON public.loan_applications;
DROP POLICY "anon_insert_ip_logs" ON public.payment_ip_logs;

ALTER POLICY "Anyone authenticated can view badges" ON public.training_badges
USING (public.has_role((SELECT auth.uid()), 'user'::public.app_role) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR public.has_role((SELECT auth.uid()), 'office_admin'::public.app_role));
ALTER POLICY "Authenticated users can view quiz questions" ON public.training_quiz_questions
USING (public.has_role((SELECT auth.uid()), 'user'::public.app_role) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR public.has_role((SELECT auth.uid()), 'office_admin'::public.app_role));
ALTER POLICY "msc_sync_runs_read" ON public.msc_flatfile_sync_runs
USING (public.has_role((SELECT auth.uid()), 'user'::public.app_role) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR public.has_role((SELECT auth.uid()), 'office_admin'::public.app_role));
ALTER POLICY "Authenticated users can view supplier catalog" ON public.suppliers
USING (public.has_role((SELECT auth.uid()), 'user'::public.app_role) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role) OR public.has_role((SELECT auth.uid()), 'office_admin'::public.app_role));

ALTER POLICY "allow public insert" ON public.win_entries
WITH CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 200 AND char_length(btrim(last_name)) BETWEEN 1 AND 200 AND char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
ALTER POLICY "allow public insert" ON public.lead_magnet_subscribers
WITH CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND (name IS NULL OR char_length(name) <= 200) AND (city IS NULL OR char_length(city) <= 200) AND (source IS NULL OR char_length(source) <= 200));
ALTER POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscribers
WITH CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND active IS TRUE AND (source IS NULL OR char_length(source) <= 200));
ALTER POLICY "Allow anonymous insert" ON public.contact_messages
WITH CHECK (char_length(btrim(name)) BETWEEN 1 AND 200 AND char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND char_length(btrim(subject)) BETWEEN 1 AND 500 AND char_length(btrim(message)) BETWEEN 1 AND 10000 AND status = 'new');