ALTER TABLE public.booking_margin_lines
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.booking_margin_lines.is_internal IS
  'Internal-only line. Hidden from the client-facing pricing breakdown but rolled into the package total.';

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  booking_id    UUID,
  booking_name  TEXT,
  description   TEXT NOT NULL,
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_optional   BOOLEAN NOT NULL DEFAULT false,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_id_idx
  ON public.invoice_line_items (invoice_id);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoice owners can view their line items"
  ON public.invoice_line_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid()
  ));

CREATE POLICY "Invoice owners can insert their line items"
  ON public.invoice_line_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid()
  ));

CREATE POLICY "Invoice owners can update their line items"
  ON public.invoice_line_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid()
  ));

CREATE POLICY "Invoice owners can delete their line items"
  ON public.invoice_line_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid()
  ));