GRANT INSERT ON public.quote_requests TO anon;

DROP POLICY IF EXISTS "anon_insert_quote_requests" ON public.quote_requests;
CREATE POLICY "anon_insert_quote_requests"
ON public.quote_requests
FOR INSERT
TO anon
WITH CHECK (true);