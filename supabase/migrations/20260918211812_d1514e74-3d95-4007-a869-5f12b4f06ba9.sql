UPDATE public.invoices
SET status = CASE
      WHEN COALESCE(amount_paid,0) <= 0 THEN 'sent'
      WHEN COALESCE(amount_remaining,0) <= 0.01 THEN 'paid'
      ELSE 'partial' END,
    updated_at = now()
WHERE status IN ('sent','partial','paid')
  AND status <> CASE
      WHEN COALESCE(amount_paid,0) <= 0 THEN 'sent'
      WHEN COALESCE(amount_remaining,0) <= 0.01 THEN 'paid'
      ELSE 'partial' END;