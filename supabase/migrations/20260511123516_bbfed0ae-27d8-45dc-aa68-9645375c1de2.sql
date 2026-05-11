CREATE OR REPLACE FUNCTION public.has_feature_permission(_user_id uuid, _feature_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  IF public.has_role(_user_id, 'admin'::app_role)
     OR public.has_role(_user_id, 'office_admin'::app_role) THEN
    RETURN TRUE;
  END IF;

  SELECT allowed INTO v_allowed
  FROM public.user_feature_permissions
  WHERE user_id = _user_id AND feature_key = _feature_key
  LIMIT 1;

  IF FOUND THEN
    RETURN v_allowed;
  END IF;

  RETURN _feature_key IN (
    'dashboard','leads','trips','quotes','clients','business_contacts',
    'suppliers','commissions','payment_reminders',
    'flight_search','hotel_search','cruise_search','excursions',
    'training','training_library','training_badges',
    'notifications','settings'
  );
END;
$function$;