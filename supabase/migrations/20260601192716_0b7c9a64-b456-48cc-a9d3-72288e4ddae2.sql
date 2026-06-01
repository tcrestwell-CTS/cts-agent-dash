
-- 1. ai_proposed_actions table
CREATE TABLE public.ai_proposed_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  summary TEXT NOT NULL,
  reasoning TEXT,
  proposed_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  confidence NUMERIC,
  auto_apply_eligible BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_apa_user_status ON public.ai_proposed_actions(user_id, status, created_at DESC);
CREATE INDEX idx_apa_agent ON public.ai_proposed_actions(agent_name, status);
CREATE INDEX idx_apa_target ON public.ai_proposed_actions(target_table, target_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_proposed_actions TO authenticated;
GRANT ALL ON public.ai_proposed_actions TO service_role;

ALTER TABLE public.ai_proposed_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own proposed actions"
  ON public.ai_proposed_actions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );

CREATE POLICY "Users insert their own proposed actions"
  ON public.ai_proposed_actions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own proposed actions"
  ON public.ai_proposed_actions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );

CREATE POLICY "Users delete their own proposed actions"
  ON public.ai_proposed_actions FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER apa_updated_at
  BEFORE UPDATE ON public.ai_proposed_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_proposed_actions;
ALTER TABLE public.ai_proposed_actions REPLICA IDENTITY FULL;

-- 2. agent_auto_apply_settings table
CREATE TABLE public.agent_auto_apply_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  auto_apply BOOLEAN NOT NULL DEFAULT false,
  max_confidence_required NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, agent_name, action_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_auto_apply_settings TO authenticated;
GRANT ALL ON public.agent_auto_apply_settings TO service_role;

ALTER TABLE public.agent_auto_apply_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own auto-apply settings"
  ON public.agent_auto_apply_settings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER aaas_updated_at
  BEFORE UPDATE ON public.agent_auto_apply_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
