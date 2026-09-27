ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS publish_override_by uuid,
  ADD COLUMN IF NOT EXISTS publish_override_reason text,
  ADD COLUMN IF NOT EXISTS publish_override_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_trip_publish_readiness(p_trip_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; has_client bool; has_price bool; has_items bool; has_cover bool;
BEGIN
  SELECT * INTO t FROM trips WHERE id = p_trip_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF auth.uid() IS NOT NULL AND t.user_id <> auth.uid()
     AND NOT has_role(auth.uid(),'admin') AND NOT has_role(auth.uid(),'office_admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  has_client := t.client_id IS NOT NULL OR coalesce(t.group_landing_enabled,false)
    OR EXISTS (SELECT 1 FROM trips c WHERE c.parent_trip_id = t.id);
  has_price := coalesce(t.total_gross_sales,0) > 0
    OR EXISTS (SELECT 1 FROM itinerary_items i WHERE i.trip_id = t.id AND coalesce(i.item_price,0) > 0)
    OR EXISTS (SELECT 1 FROM bookings b WHERE b.trip_id = t.id);
  has_items := EXISTS (SELECT 1 FROM itinerary_items i WHERE i.trip_id = t.id AND NOT coalesce(i.is_hidden,false));
  has_cover := t.cover_image_url IS NOT NULL
    OR EXISTS (SELECT 1 FROM itineraries i WHERE i.trip_id = t.id AND i.cover_image_url IS NOT NULL);
  RETURN jsonb_build_array(
    jsonb_build_object('key','client','label','Client linked','required',true,'passed',has_client,
      'detail','Link a client (group trips with a landing page or sub-trips pass automatically)'),
    jsonb_build_object('key','pricing','label','Pricing entered','required',true,'passed',has_price,
      'detail','Add a booking, a priced itinerary item, or trip totals'),
    jsonb_build_object('key','itinerary','label','Itinerary has items','required',true,'passed',has_items,
      'detail','Add at least one visible itinerary item'),
    jsonb_build_object('key','cover','label','Cover image set','required',false,'passed',has_cover,
      'detail','Add a cover photo for a stronger first impression')
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_trip_publish_readiness(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_trip_publish_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE checks jsonb; missing text;
BEGIN
  IF NEW.published_at IS NULL OR NEW.published_at IS NOT DISTINCT FROM OLD.published_at THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF; -- backend/system jobs
  checks := get_trip_publish_readiness(NEW.id);
  SELECT string_agg(c->>'label', ', ') INTO missing
  FROM jsonb_array_elements(checks) c
  WHERE (c->>'required')::bool AND NOT (c->>'passed')::bool;
  IF missing IS NULL THEN RETURN NEW; END IF;
  IF NEW.publish_override_at IS NOT NULL AND NEW.publish_override_at > now() - interval '5 minutes'
     AND NEW.publish_override_by = auth.uid()
     AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'office_admin'))
     AND length(coalesce(trim(NEW.publish_override_reason),'')) >= 5 THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Cannot publish: missing %', missing USING ERRCODE = 'P0001';
END $$;

DROP TRIGGER IF EXISTS trg_enforce_trip_publish_gate ON public.trips;
CREATE TRIGGER trg_enforce_trip_publish_gate BEFORE UPDATE OF published_at ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.enforce_trip_publish_gate();