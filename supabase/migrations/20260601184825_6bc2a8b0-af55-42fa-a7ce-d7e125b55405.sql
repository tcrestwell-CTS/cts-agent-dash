CREATE POLICY "Admins can delete quote requests"
ON public.quote_requests
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'office_admin'::app_role)
);