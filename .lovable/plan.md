

# Level 4: Financial Architecture Optimization

Complete the automated accounting lifecycle and build a unified reconciliation dashboard that eliminates end-of-month chaos.

---

## What Already Exists

The platform already has significant financial automation in place:

- **4 database triggers** fire the `qbo-sync-trigger` edge function automatically:
  - `deposit_posted`: Client payment completed -> 3-step Stripe Clearing journal entries (Gross, Fees, Net)
  - `booking_confirmed`: Booking status -> confirmed -> QBO Invoice created
  - `commission_received`: Commission status -> paid -> Journal entry (Debit Checking, Credit Commission Income)
  - `payout_approved`: Override approved -> QBO Expense (Advisor payout)
- **Stripe Clearing Reconciliation Report** on QBOHealth page (balance, by-date breakdown, balanced/unbalanced badge)
- **Manual sync actions**: Sync Clients, Sync Payments, Sync Stripe Deposits, Stripe Clearing Flow
- **Auto-provisioning** of QBO accounts (Stripe Clearing, Stripe Processing Fees)

---

## What's Missing

### Gap 1: Incomplete Journal Posting Lifecycle
Two booking events are **not** automated:
- **Virtual card authorized** (supplier payment via Stripe Issuing) -- no journal entry is created
- **Trip completion** (liability-to-revenue recognition) -- no automation exists

The documented 5-step lifecycle should be:
1. Client Payment -> Debit Stripe Clearing, Credit Client Deposit (liability) -- **partially done** (currently credits A/R instead of a liability account)
2. Supplier Payment (virtual card charge) -> Debit Supplier Expense, Credit Stripe Clearing -- **not automated**
3. Trip Completion -> Debit Client Deposit (liability), Credit Commission Revenue -- **not automated**
4. Commission Split -> Debit Advisor Commission Expense, Credit Advisor Payable -- **exists** (payout_approved)
5. Advisor Payout -> Debit Advisor Payable, Credit Bank -- **exists** (commission_received)

### Gap 2: No Unified Financial Lifecycle View
The QBOHealth page shows Stripe Clearing reconciliation, but there's no view that shows the **complete money flow per trip**: client payment -> supplier payment -> commission -> payout. Admins have to mentally stitch together data from multiple pages.

---

## Plan

### 1. Add Two New Automated Triggers

**Trigger: Virtual Card Transaction (Supplier Payment)**
- When the `stripe-issuing-webhook` processes an `issuing_transaction.created` event and auto-locks a card, also fire a `qbo-sync-trigger` call with `trigger_type: 'supplier_paid'`
- The handler creates a journal entry: Debit "Supplier Expense", Credit "Stripe Clearing"
- This accounts for money leaving the clearing account to pay a supplier

**Trigger: Trip Completed (Revenue Recognition)**
- The existing `trigger_post_trip_email` fires when trip status changes to 'completed'
- Add a new database trigger `trigger_qbo_trip_completed` on the `trips` table that fires when status changes to 'completed'
- The handler creates a journal entry: Debit "Client Deposit" (liability), Credit "Commission Revenue"
- Uses the trip's `total_commission_revenue` amount

### 2. New Handler in `qbo-sync-trigger`

Add two new cases to the existing `qbo-sync-trigger` edge function:
- `supplier_paid`: Creates journal entry (Debit Supplier Expense, Credit Stripe Clearing) using the virtual card authorization amount
- `trip_completed`: Creates journal entry (Debit Client Deposit, Credit Commission Revenue) using the trip's total commission revenue

Both will auto-provision any missing QBO accounts (Client Deposit, Supplier Expense, Commission Revenue).

### 3. Enhanced Reconciliation Dashboard

Upgrade the existing QBOHealth page with a new **"Financial Lifecycle"** section:

**Per-Trip Money Flow Table**
- Query trips with their bookings, payments, and commissions
- For each trip, show a row with columns:
  - Trip Name / Client
  - Client Paid (sum of completed trip_payments)
  - Stripe Fees (calculated)
  - Supplier Paid (sum of bookings with virtual_card_status = 'authorized' or 'locked')
  - Commission Earned (total_commission_revenue)
  - Commission Paid Out (sum of paid commissions)
  - Net Position (Client Paid - Fees - Supplier Paid - Commission Paid)
- Color coding: Green = balanced (net near zero for completed trips), Amber = in progress, Red = discrepancy

**Unmatched Transactions Alert**
- Show payments without matching journal entries in QBO sync logs
- Show virtual card charges without corresponding supplier expense entries
- Actionable: "Sync Now" button per unmatched item

### 4. Journal Entry Audit Trail

Add a new section to QBOHealth showing the automated journal entries log:
- Filter `qbo_sync_logs` by `sync_type` starting with "auto-"
- Show: Date, Type (deposit/supplier/commission/payout/trip-complete), Amount, Status, QBO Entry ID
- This replaces manually checking QBO for each entry

---

## Database Changes

```sql
-- New trigger for trip completion -> QBO journal entry
CREATE OR REPLACE FUNCTION public.trigger_qbo_trip_completed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _service_key text;
BEGIN
  IF NEW.status = 'completed' 
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND COALESCE(NEW.total_commission_revenue, 0) > 0 THEN
    
    SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;

    PERFORM net.http_post(
      url := 'https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/qbo-sync-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := jsonb_build_object(
        'trigger_type', 'trip_completed',
        'record', row_to_json(NEW)::jsonb
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_qbo_trip_completed
  AFTER UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_qbo_trip_completed();
```

No new tables needed -- all data is already in `qbo_sync_logs`, `trip_payments`, `bookings`, `commissions`, and `trips`.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/qbo-sync-trigger/index.ts` | Add `supplier_paid` and `trip_completed` handlers with auto-provisioned accounts |
| `supabase/functions/stripe-issuing-webhook/index.ts` | After auto-locking a card on `issuing_transaction.created`, fire `qbo-sync-trigger` with `supplier_paid` |
| `src/pages/QBOHealth.tsx` | Add "Financial Lifecycle" per-trip table, unmatched transactions alert, and journal entry audit trail |
| `src/hooks/useQBOConnection.ts` | Add `getFinancialLifecycle()` method to fetch per-trip money flow data |
| Database migration | Add `trigger_qbo_trip_completed` trigger and function |

## Files to Create

| File | Purpose |
|------|---------|
| None | All changes fit within existing files |

---

## Implementation Order

1. Database migration (trip_completed trigger)
2. Add `supplier_paid` and `trip_completed` handlers to `qbo-sync-trigger`
3. Update `stripe-issuing-webhook` to fire supplier_paid after card lock
4. Add Financial Lifecycle section to QBOHealth page
5. Add Journal Entry Audit Trail to QBOHealth page
6. Add unmatched transaction detection

