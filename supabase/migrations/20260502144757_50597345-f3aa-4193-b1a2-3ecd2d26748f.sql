-- Commission payments table: one row per actual ACH/check deposit applied to a commission
CREATE TABLE public.commission_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commission_id UUID NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  paid_date DATE NOT NULL,
  payment_method TEXT,
  payment_reference TEXT,
  supplier_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_payments_commission_id ON public.commission_payments(commission_id);
CREATE INDEX idx_commission_payments_booking_id ON public.commission_payments(booking_id);
CREATE INDEX idx_commission_payments_user_id ON public.commission_payments(user_id);
CREATE INDEX idx_commission_payments_paid_date ON public.commission_payments(paid_date);

ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own commission payments"
ON public.commission_payments FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Users insert own commission payments"
ON public.commission_payments FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Users update own commission payments"
ON public.commission_payments FOR UPDATE
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Admins delete commission payments"
ON public.commission_payments FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'office_admin'::app_role));

CREATE TRIGGER trg_commission_payments_updated_at
BEFORE UPDATE ON public.commission_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();