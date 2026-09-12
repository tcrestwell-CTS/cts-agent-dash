ALTER TABLE public.ctn_approval_log DROP CONSTRAINT ctn_approval_log_action_type_check;
ALTER TABLE public.ctn_approval_log ADD CONSTRAINT ctn_approval_log_action_type_check
  CHECK (action_type = ANY (ARRAY['invite','existing_user','docs_only','payment_pending','unmatched_payment','fulfillment_failed','payment_failed']));
ALTER TABLE public.ctn_approval_log DROP CONSTRAINT ctn_approval_log_status_check;
ALTER TABLE public.ctn_approval_log ADD CONSTRAINT ctn_approval_log_status_check
  CHECK (status = ANY (ARRAY['processing','succeeded','failed','pending_payment','needs_review','resolved']));