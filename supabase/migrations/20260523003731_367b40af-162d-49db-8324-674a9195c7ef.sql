
CREATE OR REPLACE FUNCTION public.notify_admins_loan_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin RECORD;
  v_title text;
  v_message text;
  v_name text;
  v_amount text;
  v_should_fire boolean := false;
BEGIN
  v_name := COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '');
  v_amount := '$' || to_char(COALESCE(NEW.loan_amount_requested, 0), 'FM999,999,990');

  IF TG_OP = 'INSERT' THEN
    v_should_fire := NEW.decision IS NOT NULL;
  ELSE
    v_should_fire := NEW.decision IS NOT NULL
                     AND NEW.decision IS DISTINCT FROM OLD.decision;
  END IF;

  IF NOT v_should_fire THEN
    RETURN NEW;
  END IF;

  IF NEW.decision = 'approved' THEN
    v_title := 'Loan Pre-Qualification: Approved';
    v_message := 'New pre-qualification: ' || trim(v_name) || ' approved for ' || v_amount;
  ELSIF NEW.decision = 'review' THEN
    v_title := 'Loan Application: Under Review';
    v_message := 'New loan application: ' || trim(v_name) || ' — under review (' || v_amount || ')';
  ELSIF NEW.decision = 'declined' THEN
    v_title := 'Loan Application: Not Approved';
    v_message := 'New loan application: ' || trim(v_name) || ' — not approved (' || v_amount || ')';
  ELSE
    RETURN NEW;
  END IF;

  FOR v_admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
  LOOP
    INSERT INTO public.agent_notifications (user_id, type, title, message)
    VALUES (v_admin.user_id, 'loan_application', v_title, v_message);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_loan_decision ON public.loan_applications;
CREATE TRIGGER trg_notify_admins_loan_decision
AFTER INSERT OR UPDATE OF decision ON public.loan_applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_loan_decision();
