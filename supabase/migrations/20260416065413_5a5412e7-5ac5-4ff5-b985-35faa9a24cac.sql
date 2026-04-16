
CREATE TABLE public.task_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_name TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'edge_function',
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  result_summary TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_runs_task_name ON public.task_runs (task_name);
CREATE INDEX idx_task_runs_started_at ON public.task_runs (started_at DESC);
CREATE INDEX idx_task_runs_task_type ON public.task_runs (task_type);
CREATE INDEX idx_task_runs_status ON public.task_runs (status);

ALTER TABLE public.task_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task runs"
ON public.task_runs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage task runs"
ON public.task_runs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
