
CREATE TABLE IF NOT EXISTS public.bookkeeper_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  resource text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bkpr_audit_actor_time
  ON public.bookkeeper_audit_log (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bkpr_audit_time
  ON public.bookkeeper_audit_log (created_at DESC);

ALTER TABLE public.bookkeeper_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bookkeepers and admins can insert their own audit rows"
  ON public.bookkeeper_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      public.is_bookkeeper(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'office_admin'::app_role)
    )
  );

CREATE POLICY "Bookkeepers and admins can view audit log"
  ON public.bookkeeper_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.is_bookkeeper(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'office_admin'::app_role)
  );
