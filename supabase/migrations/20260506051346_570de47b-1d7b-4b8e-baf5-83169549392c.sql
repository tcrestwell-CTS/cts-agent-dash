-- Per-user feature permission overrides
CREATE TABLE public.user_feature_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feature_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_key)
);

CREATE INDEX idx_user_feature_permissions_user ON public.user_feature_permissions(user_id);

ALTER TABLE public.user_feature_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own permission rows
CREATE POLICY "Users view own feature permissions"
ON public.user_feature_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins view all feature permissions"
ON public.user_feature_permissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins fully manage (insert/update/delete)
CREATE POLICY "Admins insert feature permissions"
ON public.user_feature_permissions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update feature permissions"
ON public.user_feature_permissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete feature permissions"
ON public.user_feature_permissions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Touch updated_at
CREATE TRIGGER trg_user_feature_permissions_updated_at
BEFORE UPDATE ON public.user_feature_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: check if a user has access to a feature.
-- Admins and office_admins always have access.
-- If user has an explicit row, use it. Otherwise fall back to the default set.
CREATE OR REPLACE FUNCTION public.has_feature_permission(_user_id UUID, _feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  -- Admins and office admins bypass
  IF public.has_role(_user_id, 'admin'::app_role)
     OR public.has_role(_user_id, 'office_admin'::app_role) THEN
    RETURN TRUE;
  END IF;

  -- Explicit override
  SELECT allowed INTO v_allowed
  FROM public.user_feature_permissions
  WHERE user_id = _user_id AND feature_key = _feature_key
  LIMIT 1;

  IF FOUND THEN
    RETURN v_allowed;
  END IF;

  -- Default set: Core + Tools (search) + own Commissions
  RETURN _feature_key IN (
    'dashboard',
    'leads',
    'trips',
    'quotes',
    'clients',
    'business_contacts',
    'suppliers',
    'commissions',
    'flight_search',
    'hotel_search',
    'cruise_search',
    'excursions',
    'training',
    'training_library',
    'training_badges',
    'notifications',
    'settings'
  );
END;
$$;