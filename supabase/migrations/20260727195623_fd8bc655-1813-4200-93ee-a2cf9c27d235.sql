
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS assigned_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_quote_requests_assigned_agent
  ON public.quote_requests(assigned_agent_id);

-- Agents can view leads assigned to them
DROP POLICY IF EXISTS "Assigned agent can view their leads" ON public.quote_requests;
CREATE POLICY "Assigned agent can view their leads"
  ON public.quote_requests
  FOR SELECT
  TO authenticated
  USING (assigned_agent_id = auth.uid());

-- Agents can update leads assigned to them
DROP POLICY IF EXISTS "Assigned agent can update their leads" ON public.quote_requests;
CREATE POLICY "Assigned agent can update their leads"
  ON public.quote_requests
  FOR UPDATE
  TO authenticated
  USING (assigned_agent_id = auth.uid())
  WITH CHECK (assigned_agent_id = auth.uid());
