CREATE TABLE public.signed_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  document_type text not null default 'ic_agreement',
  plan text,
  storage_bucket text not null default 'signed-agreements',
  storage_path text not null,
  signature text,
  signature_date date,
  agreements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX signed_documents_email_idx ON public.signed_documents (lower(email));

GRANT SELECT ON public.signed_documents TO authenticated;
GRANT ALL ON public.signed_documents TO service_role;

ALTER TABLE public.signed_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all signed documents"
ON public.signed_documents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Agents can view their own signed documents"
ON public.signed_documents FOR SELECT TO authenticated
USING (user_id = auth.uid() OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE TRIGGER update_signed_documents_updated_at
BEFORE UPDATE ON public.signed_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ic_onboarding ADD COLUMN IF NOT EXISTS signed_agreement_path text;

CREATE POLICY "Admins can read signed agreements"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'signed-agreements' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin')));