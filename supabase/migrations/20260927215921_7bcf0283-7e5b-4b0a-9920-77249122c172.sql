CREATE OR REPLACE FUNCTION public.reorder_itinerary_items(p_updates jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH u AS (
    SELECT (e->>'id')::uuid AS id,
           NULLIF(e->>'day_number','')::int AS day_number,
           NULLIF(e->>'sort_order','')::int AS sort_order,
           e ? 'option_block_id' AS has_block,
           NULLIF(e->>'option_block_id','')::uuid AS option_block_id
    FROM jsonb_array_elements(p_updates) e
  ), done AS (
    UPDATE itinerary_items i SET
      day_number = COALESCE(u.day_number, i.day_number),
      sort_order = COALESCE(u.sort_order, i.sort_order),
      option_block_id = CASE WHEN u.has_block THEN u.option_block_id ELSE i.option_block_id END
    FROM u WHERE i.id = u.id
    RETURNING 1
  )
  SELECT count(*)::int FROM done;
$$;
REVOKE EXECUTE ON FUNCTION public.reorder_itinerary_items(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_itinerary_items(jsonb) TO authenticated;