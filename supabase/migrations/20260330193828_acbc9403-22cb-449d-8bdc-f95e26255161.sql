
CREATE TABLE public.portal_client_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_enabled BOOLEAN NOT NULL DEFAULT true,
  visible_sections TEXT[] NOT NULL DEFAULT ARRAY['dashboard','trips','payments','messages','invoices'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE public.portal_client_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own portal settings"
  ON public.portal_client_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all portal settings"
  ON public.portal_client_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_portal_client_settings_updated_at
  BEFORE UPDATE ON public.portal_client_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
