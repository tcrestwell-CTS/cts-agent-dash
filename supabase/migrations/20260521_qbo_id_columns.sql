-- Migration: QBO ID columns on clients + suppliers for direct lookups
-- Run in CTS Supabase (zbtnulzvwreqzbmxulpv) SQL Editor

-- 1. Add qbo_customer_id to clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS qbo_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_qbo_customer_id
  ON clients(qbo_customer_id) WHERE qbo_customer_id IS NOT NULL;

-- 2. Add qbo_vendor_id to suppliers  
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS qbo_vendor_id TEXT;

CREATE INDEX IF NOT EXISTS idx_suppliers_qbo_vendor_id
  ON suppliers(qbo_vendor_id) WHERE qbo_vendor_id IS NOT NULL;

-- 3. Add stripe_fee column to trip_payments so actual Stripe fees
--    are available when qbo-sync-trigger fires handleDepositPosted
ALTER TABLE trip_payments
  ADD COLUMN IF NOT EXISTS stripe_fee NUMERIC(10,2);

ALTER TABLE trip_payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- 4. Backfill qbo_customer_id from existing qbo_client_mappings
UPDATE clients c
SET qbo_customer_id = m.qbo_customer_id
FROM qbo_client_mappings m
WHERE m.client_id = c.id
  AND c.qbo_customer_id IS NULL;

-- 5. Backfill qbo_vendor_id from existing qbo_supplier_mappings
UPDATE suppliers s
SET qbo_vendor_id = m.qbo_vendor_id
FROM qbo_supplier_mappings m
WHERE m.supplier_id = s.id
  AND s.qbo_vendor_id IS NULL;

-- Verify backfill
SELECT
  (SELECT COUNT(*) FROM clients WHERE qbo_customer_id IS NOT NULL)    AS clients_with_qbo_id,
  (SELECT COUNT(*) FROM suppliers WHERE qbo_vendor_id IS NOT NULL)    AS suppliers_with_qbo_id,
  (SELECT COUNT(*) FROM qbo_client_mappings)                          AS total_client_mappings,
  (SELECT COUNT(*) FROM qbo_supplier_mappings)                        AS total_supplier_mappings;
