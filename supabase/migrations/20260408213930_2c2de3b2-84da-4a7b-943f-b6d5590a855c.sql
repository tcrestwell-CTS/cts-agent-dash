
CREATE TABLE public.business_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  job_title TEXT,
  industry TEXT,
  website TEXT,
  linkedin_url TEXT,
  revenue_size TEXT,
  employee_count TEXT,
  lead_source TEXT,
  lead_status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  follow_up_date DATE,
  tags TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business contacts"
  ON public.business_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own business contacts"
  ON public.business_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business contacts"
  ON public.business_contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own business contacts"
  ON public.business_contacts FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_business_contacts_updated_at
  BEFORE UPDATE ON public.business_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_business_contacts_user_id ON public.business_contacts(user_id);
CREATE INDEX idx_business_contacts_lead_status ON public.business_contacts(lead_status);
