-- Backfill script: link historical checkout_payments to CRM records
-- Run in CTS Supabase SQL Editor AFTER the migration above
-- Reviews each unlinked payment and attempts to match by customer_email

-- Step 1: Preview what will be matched (read-only, safe to run first)
SELECT
  cp.id,
  cp.customer_email,
  cp.trip_name,
  cp.booking_ref,
  cp.amount_cents,
  cp.payment_type,
  cp.created_at,
  c.id        AS matched_client_id,
  tp.id       AS matched_trip_payment_id,
  tp.trip_id  AS matched_trip_id,
  c.assigned_agent_id AS matched_agent_user_id
FROM checkout_payments cp
LEFT JOIN clients c
  ON lower(c.email) = lower(cp.customer_email)
LEFT JOIN trips t
  ON t.client_id = c.id
LEFT JOIN trip_payments tp
  ON tp.trip_id = t.id
  AND tp.status = 'pending'
  AND ABS(tp.amount - cp.amount_cents) < 500  -- within $5 tolerance
WHERE cp.trip_payment_id IS NULL
  AND cp.payment_type IN ('deposit', 'unattributed_deposit')
  AND cp.status IN ('succeeded', 'pending')
ORDER BY cp.created_at DESC;

-- Step 2: Apply the backfill (uncomment to run after reviewing Step 1 output)
/*
UPDATE checkout_payments cp
SET
  trip_payment_id  = tp.id,
  trip_id          = tp.trip_id,
  agent_user_id    = c.assigned_agent_id,
  payment_type     = CASE
    WHEN tp.id IS NOT NULL THEN 'trip_installment'
    ELSE 'unattributed_deposit'
  END
FROM clients c
LEFT JOIN trips t   ON t.client_id = c.id
LEFT JOIN trip_payments tp
  ON tp.trip_id = t.id
  AND tp.status = 'pending'
  AND ABS(tp.amount - cp.amount_cents) < 500
WHERE lower(c.email) = lower(cp.customer_email)
  AND cp.trip_payment_id IS NULL
  AND cp.payment_type IN ('deposit', 'unattributed_deposit');
*/

-- Step 3: Report remaining unmatched (should go to clearing queue)
/*
SELECT
  id, customer_email, customer_name, amount_cents, payment_type,
  booking_ref, trip_name, created_at
FROM checkout_payments
WHERE trip_payment_id IS NULL
  AND payment_type IN ('deposit', 'unattributed_deposit')
ORDER BY created_at DESC;
*/
