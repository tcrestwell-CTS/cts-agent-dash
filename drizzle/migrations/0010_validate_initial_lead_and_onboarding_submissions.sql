ALTER POLICY "Allow anonymous insert" ON public.quote_requests
WITH CHECK (
  char_length(btrim(first_name)) BETWEEN 1 AND 200
  AND char_length(btrim(last_name)) BETWEEN 1 AND 200
  AND char_length(email) BETWEEN 3 AND 254
  AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  AND status = 'new'
  AND ai_score IS NULL AND ai_stage IS NULL AND ai_summary IS NULL
  AND ai_tags IS NULL AND ai_next_action IS NULL AND ai_processed_at IS NULL
  AND sequence_started IS FALSE AND sequence_paused IS FALSE
  AND proposal_draft IS NULL AND proposal_status IS NULL AND proposal_options IS NULL
  AND proposal_sent_at IS NULL AND proposal_viewed_at IS NULL
  AND proposal_approved_at IS NULL AND proposal_expires_at IS NULL
  AND selected_option IS NULL AND converted_trip_id IS NULL
);
ALTER POLICY "authenticated_insert_quote_requests" ON public.quote_requests
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'office_admin'::public.app_role)
  OR (
    char_length(btrim(first_name)) BETWEEN 1 AND 200
    AND char_length(btrim(last_name)) BETWEEN 1 AND 200
    AND char_length(email) BETWEEN 3 AND 254
    AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    AND (assigned_agent_id IS NULL OR assigned_agent_id = (SELECT auth.uid()))
    AND status = 'new'
    AND ai_score IS NULL AND ai_stage IS NULL AND ai_summary IS NULL
    AND ai_tags IS NULL AND ai_next_action IS NULL AND ai_processed_at IS NULL
    AND sequence_started IS FALSE AND sequence_paused IS FALSE
    AND proposal_draft IS NULL AND proposal_status IS NULL AND proposal_options IS NULL
    AND proposal_sent_at IS NULL AND proposal_viewed_at IS NULL
    AND proposal_approved_at IS NULL AND proposal_expires_at IS NULL
    AND selected_option IS NULL AND converted_trip_id IS NULL
  )
);
ALTER POLICY "anon_insert_onboarding" ON public.ic_onboarding
WITH CHECK (
  char_length(btrim(first_name)) BETWEEN 1 AND 200
  AND char_length(btrim(last_name)) BETWEEN 1 AND 200
  AND char_length(email) BETWEEN 3 AND 254
  AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  AND status = 'pending_review'
  AND agent_dash_synced_at IS NULL AND signed_agreement_path IS NULL
);
ALTER POLICY "authenticated_insert_onboarding" ON public.ic_onboarding
WITH CHECK (
  char_length(btrim(first_name)) BETWEEN 1 AND 200
  AND char_length(btrim(last_name)) BETWEEN 1 AND 200
  AND char_length(email) BETWEEN 3 AND 254
  AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  AND status = 'pending_review'
  AND agent_dash_synced_at IS NULL AND signed_agreement_path IS NULL
);