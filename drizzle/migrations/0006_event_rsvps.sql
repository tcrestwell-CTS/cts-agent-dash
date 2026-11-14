CREATE TABLE public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  section_id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  attending boolean NOT NULL,
  party_size integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, section_id, email)
);
GRANT SELECT, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins view rsvps" ON public.event_rsvps FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'office_admin') OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));
CREATE POLICY "Owners and admins delete rsvps" ON public.event_rsvps FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.submit_event_rsvp(p_token text, p_section_id text, p_name text, p_email text, p_attending boolean, p_party_size integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_trip uuid; v_total integer;
BEGIN
  SELECT id INTO v_trip FROM trips WHERE share_token = p_token;
  IF v_trip IS NULL THEN RAISE EXCEPTION 'Invalid link'; END IF;
  IF length(trim(coalesce(p_name,''))) < 2 OR length(p_name) > 120 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(p_email) > 255 THEN RAISE EXCEPTION 'Valid email required'; END IF;
  IF p_attending AND (p_party_size < 1 OR p_party_size > 20) THEN RAISE EXCEPTION 'Party size must be 1-20'; END IF;
  INSERT INTO event_rsvps (trip_id, section_id, name, email, attending, party_size)
  VALUES (v_trip, left(p_section_id,100), trim(p_name), lower(trim(p_email)), p_attending, CASE WHEN p_attending THEN p_party_size ELSE 0 END)
  ON CONFLICT (trip_id, section_id, email) DO UPDATE SET name = EXCLUDED.name, attending = EXCLUDED.attending, party_size = EXCLUDED.party_size, updated_at = now();
  SELECT coalesce(sum(party_size),0) INTO v_total FROM event_rsvps WHERE trip_id = v_trip AND section_id = p_section_id AND attending;
  RETURN v_total;
END $$;

CREATE OR REPLACE FUNCTION public.get_event_rsvp_total(p_token text, p_section_id text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(r.party_size),0)::int FROM event_rsvps r JOIN trips t ON t.id = r.trip_id
  WHERE t.share_token = p_token AND r.section_id = p_section_id AND r.attending;
$$;
GRANT EXECUTE ON FUNCTION public.submit_event_rsvp(text,text,text,text,boolean,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_rsvp_total(text,text) TO anon, authenticated;