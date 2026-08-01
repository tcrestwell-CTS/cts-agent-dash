ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS booking_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS booking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_timezone text NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS booking_instructions text,
  ADD COLUMN IF NOT EXISTS booking_contact_phone text;

CREATE TABLE public.agent_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 10 AND 240),
  buffer_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE TABLE public.agent_availability_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE public.agent_meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  topic text,
  notes text,
  agent_notes text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York',
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_agent_availability_user ON public.agent_availability(user_id, day_of_week);
CREATE INDEX idx_agent_blocks_user ON public.agent_availability_blocks(user_id, starts_at);
CREATE INDEX idx_agent_meetings_user_start ON public.agent_meetings(user_id, starts_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_availability TO authenticated;
GRANT SELECT ON public.agent_availability TO anon;
GRANT ALL ON public.agent_availability TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_availability_blocks TO authenticated;
GRANT SELECT ON public.agent_availability_blocks TO anon;
GRANT ALL ON public.agent_availability_blocks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_meetings TO authenticated;
GRANT INSERT ON public.agent_meetings TO anon;
GRANT ALL ON public.agent_meetings TO service_role;

ALTER TABLE public.agent_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own availability" ON public.agent_availability
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Public can read availability of bookable agents" ON public.agent_availability
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = agent_availability.user_id AND p.booking_enabled));

CREATE POLICY "Agents manage own blocks" ON public.agent_availability_blocks
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Public can read blocks of bookable agents" ON public.agent_availability_blocks
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = agent_availability_blocks.user_id AND p.booking_enabled));

CREATE POLICY "Agents view own meetings" ON public.agent_meetings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Agents update own meetings" ON public.agent_meetings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Agents delete own meetings" ON public.agent_meetings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Anyone can request a meeting with a bookable agent" ON public.agent_meetings
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = agent_meetings.user_id AND p.booking_enabled));

CREATE TRIGGER update_agent_availability_updated_at BEFORE UPDATE ON public.agent_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agent_blocks_updated_at BEFORE UPDATE ON public.agent_availability_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agent_meetings_updated_at BEFORE UPDATE ON public.agent_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();