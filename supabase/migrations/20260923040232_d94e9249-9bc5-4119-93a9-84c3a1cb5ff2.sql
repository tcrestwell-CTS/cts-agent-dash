CREATE TABLE public.group_proposal_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'advisor_review' CHECK (status IN ('advisor_review','contacted','confirmed','declined','expired')),
  traveler_name text NOT NULL,
  second_traveler_name text,
  party_size integer NOT NULL DEFAULT 2 CHECK (party_size BETWEEN 1 AND 8),
  email text NOT NULL,
  phone text,
  sailing_id text NOT NULL,
  sailing_label text NOT NULL,
  cruise_start_date date NOT NULL,
  cruise_end_date date NOT NULL,
  cruise_nights integer NOT NULL DEFAULT 7,
  cabin_id text NOT NULL,
  cabin_category text NOT NULL,
  cabin_price_per_person numeric(12,2) NOT NULL,
  cabin_total numeric(12,2) NOT NULL,
  hotel_id text NOT NULL,
  hotel_name text NOT NULL,
  hotel_room_id text NOT NULL,
  hotel_room_type text NOT NULL,
  hotel_check_in date NOT NULL,
  hotel_check_out date NOT NULL,
  hotel_nightly_rate numeric(12,2) NOT NULL,
  hotel_nights integer NOT NULL DEFAULT 2,
  hotel_base_total numeric(12,2) NOT NULL,
  hotel_known_fees numeric(12,2) NOT NULL DEFAULT 0,
  hotel_taxes_fees numeric(12,2),
  cruise_service_charges numeric(12,2),
  free_at_sea_selection text NOT NULL,
  excursions_selection text NOT NULL,
  excursion_total numeric(12,2),
  group_benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  optional_upgrades jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_known_total numeric(12,2) NOT NULL,
  quoted_total numeric(12,2) NOT NULL,
  confirmed_total numeric(12,2),
  payment_status text NOT NULL DEFAULT 'not_started',
  booking_status text NOT NULL DEFAULT 'proposal_submitted',
  confirmation_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  special_requests text,
  accessibility_requirements text,
  additional_comments text,
  advisor_notes text,
  disclosure_version text NOT NULL DEFAULT 'hawaii-2027-v1',
  disclosure_accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_proposal_selections TO authenticated;
GRANT ALL ON public.group_proposal_selections TO service_role;

ALTER TABLE public.group_proposal_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors view proposal selections for their trips"
ON public.group_proposal_selections
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'office_admin')
);

CREATE POLICY "Advisors update proposal selections for their trips"
ON public.group_proposal_selections
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'office_admin')
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'office_admin')
);

CREATE POLICY "Advisors remove proposal selections for their trips"
ON public.group_proposal_selections
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'office_admin')
);

CREATE INDEX group_proposal_selections_trip_created_idx
ON public.group_proposal_selections (trip_id, created_at DESC);

CREATE INDEX group_proposal_selections_user_status_idx
ON public.group_proposal_selections (user_id, status);

CREATE TRIGGER set_group_proposal_selections_updated_at
BEFORE UPDATE ON public.group_proposal_selections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();