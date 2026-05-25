-- Circle Members
CREATE TABLE IF NOT EXISTS public.circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT,
  email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'circle' CHECK (tier IN ('circle','premier','founders_society')),
  founding_member BOOLEAN NOT NULL DEFAULT false,
  trial_ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','unsubscribed','cancelled')),
  source TEXT DEFAULT 'landing_page' CHECK (source IN ('landing_page','email_reply','manual')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS circle_members_email_unique ON public.circle_members (lower(email));
CREATE INDEX IF NOT EXISTS circle_members_status_idx ON public.circle_members (status);
CREATE INDEX IF NOT EXISTS circle_members_tier_idx ON public.circle_members (tier);
CREATE INDEX IF NOT EXISTS circle_members_client_id_idx ON public.circle_members (client_id);

ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_select_circle_members" ON public.circle_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "agents_insert_circle_members" ON public.circle_members
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "agents_update_circle_members" ON public.circle_members
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "agents_delete_circle_members" ON public.circle_members
  FOR DELETE TO authenticated USING (true);
CREATE POLICY "anon_insert_circle_members" ON public.circle_members
  FOR INSERT TO anon WITH CHECK (true);

CREATE TRIGGER set_circle_members_updated_at
  BEFORE UPDATE ON public.circle_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-link new members to existing clients by email
CREATE OR REPLACE FUNCTION public.link_circle_member_to_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NULL AND NEW.email IS NOT NULL THEN
    UPDATE public.circle_members
    SET client_id = (
      SELECT id FROM public.clients
      WHERE lower(email) = lower(NEW.email)
      LIMIT 1
    )
    WHERE id = NEW.id AND client_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER circle_member_client_link
  AFTER INSERT ON public.circle_members
  FOR EACH ROW EXECUTE FUNCTION public.link_circle_member_to_client();

-- Circle Briefings
CREATE TABLE IF NOT EXISTS public.circle_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issue_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  the_port TEXT,
  booking_window TEXT,
  from_the_circle TEXT,
  coming_up TEXT,
  sent_at TIMESTAMPTZ,
  sent_to_count INTEGER,
  scheduled_for TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sent'))
);

ALTER TABLE public.circle_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_all_circle_briefings" ON public.circle_briefings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_circle_briefings_updated_at
  BEFORE UPDATE ON public.circle_briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Circle Invitations (founding-member outreach to past clients)
CREATE TABLE IF NOT EXISTS public.circle_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  email TEXT,
  subject_variant TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS circle_invitations_client_id_idx ON public.circle_invitations (client_id);

ALTER TABLE public.circle_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_all_circle_invitations" ON public.circle_invitations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);