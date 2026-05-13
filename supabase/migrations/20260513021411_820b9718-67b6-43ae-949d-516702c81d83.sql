
CREATE TABLE IF NOT EXISTS public.qbo_payment_review_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qbo_payment_id TEXT NOT NULL UNIQUE,
  decision TEXT NOT NULL DEFAULT 'pending',
  target_qbo_invoice_id TEXT,
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qbo_payment_review_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view review decisions"
ON public.qbo_payment_review_decisions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Admins can insert review decisions"
ON public.qbo_payment_review_decisions FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Admins can update review decisions"
ON public.qbo_payment_review_decisions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'office_admin'));

CREATE POLICY "Admins can delete review decisions"
ON public.qbo_payment_review_decisions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_qbo_payment_review_decisions_updated_at
BEFORE UPDATE ON public.qbo_payment_review_decisions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
