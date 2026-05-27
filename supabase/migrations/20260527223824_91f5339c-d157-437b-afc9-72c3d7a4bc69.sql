
-- campaign_audiences: scope to owner + admin/office_admin
DROP POLICY IF EXISTS "auth full access audiences" ON public.campaign_audiences;
CREATE POLICY "Owners and staff manage audiences"
ON public.campaign_audiences
FOR ALL
TO authenticated
USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role))
WITH CHECK (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role));

-- campaign_events: scope SELECT to campaign owner + admin/office_admin
DROP POLICY IF EXISTS "auth read events" ON public.campaign_events;
CREATE POLICY "Owners and staff read events"
ON public.campaign_events
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'office_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_events.campaign_id AND c.created_by = auth.uid()
  )
);

-- circle_briefings: keep read for authenticated, restrict writes to admins
DROP POLICY IF EXISTS "agents_all_circle_briefings" ON public.circle_briefings;
CREATE POLICY "Agents read circle briefings"
ON public.circle_briefings
FOR SELECT
TO authenticated
USING (true);
CREATE POLICY "Staff manage circle briefings"
ON public.circle_briefings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role));

-- circle_members: restrict to admin/office_admin (preserve anon insert for signup flow)
DROP POLICY IF EXISTS "agents_select_circle_members" ON public.circle_members;
DROP POLICY IF EXISTS "agents_insert_circle_members" ON public.circle_members;
DROP POLICY IF EXISTS "agents_update_circle_members" ON public.circle_members;
DROP POLICY IF EXISTS "agents_delete_circle_members" ON public.circle_members;
CREATE POLICY "Staff manage circle members"
ON public.circle_members
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role));

-- circle_invitations: restrict to admin/office_admin
DROP POLICY IF EXISTS "agents_all_circle_invitations" ON public.circle_invitations;
CREATE POLICY "Staff manage circle invitations"
ON public.circle_invitations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role));

-- task_runs: scope to owner + admin/office_admin
DROP POLICY IF EXISTS "Authenticated users can view task runs" ON public.task_runs;
CREATE POLICY "Users view own task runs"
ON public.task_runs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office_admin'::app_role));
