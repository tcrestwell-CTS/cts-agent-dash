CREATE TABLE IF NOT EXISTS public.ic_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending_review',
  first_name text,
  last_name text,
  email text UNIQUE,
  phone text,
  dob date,
  address text,
  city text,
  state text,
  zip text,
  id_type text,
  id_number text,
  seller_of_travel_number text,
  seller_of_travel_states text,
  has_eo text,
  eo_carrier text,
  eo_policy_number text,
  eo_expiry date,
  w9_submitted boolean DEFAULT false,
  business_name text,
  business_entity text,
  ein text,
  years_experience text,
  annual_sales_volume text,
  specialties text,
  top_destinations text,
  website text,
  instagram text,
  facebook text,
  bio text,
  headshot_url text,
  directory_consent boolean DEFAULT false,
  marketing_consent boolean DEFAULT false,
  backup_advisor text,
  emergency_contact text,
  emergency_phone text,
  clia_number text,
  iata_number text,
  arc_number text,
  current_host text,
  has_transfer_bookings text,
  supplier_portals text,
  hotel_programs text,
  supplier_notes text,
  crm_preference text,
  email_domain_preference text,
  own_domain text,
  needs_website text,
  payment_method text,
  bank_name text,
  routing_number text,
  account_number text,
  ic_agreement_signed boolean DEFAULT false,
  code_of_ethics_signed boolean DEFAULT false,
  media_release_signed boolean DEFAULT false,
  data_consent_signed boolean DEFAULT false,
  signature text,
  signature_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.ic_onboarding TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ic_onboarding TO authenticated;
GRANT ALL ON public.ic_onboarding TO service_role;

ALTER TABLE public.ic_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_onboarding" ON public.ic_onboarding
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "authenticated_insert_onboarding" ON public.ic_onboarding
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "admins_view_onboarding" ON public.ic_onboarding
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "admins_update_onboarding" ON public.ic_onboarding
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "admins_delete_onboarding" ON public.ic_onboarding
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));

CREATE TRIGGER update_ic_onboarding_updated_at
  BEFORE UPDATE ON public.ic_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();