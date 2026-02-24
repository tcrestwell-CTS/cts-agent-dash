

# Level 5: Risk & Compliance Layer

Add legal protection infrastructure for the platform's roles as payment intermediary, commission distributor, and virtual card issuer.

---

## What Already Exists

- **T&C acceptance**: `terms_accepted_at` and `acceptance_signature` on `trip_payments`; 3-checkbox agreement + e-signature in `SharedTripInvestment`
- **CC Authorization**: Full signed authorization flow with encrypted storage and 30-day auto-delete
- **Booking statuses**: Include `cancelled` with `cancellation_terms` text field per booking
- **Refund status**: `trip_payments.status` already supports `refunded` value with UI badges
- **Stripe Issuing webhook**: Handles auth requests, transactions, card locking
- **QBO sync triggers**: Automated journal entries for deposits, bookings, commissions, payouts, supplier payments, trip completion

## What's Missing

1. **No audit log** of T&C acceptance events (IP, user agent, timestamp, signature)
2. **No refund tracking dashboard** -- refunded payments exist but no centralized view
3. **No chargeback/dispute detection** -- Stripe disputes are not captured
4. **No supplier cancellation tracking** -- bookings can be cancelled but no structured cancellation record (date, penalty, refund amount)
5. **No IP capture** on proposal approvals

---

## Plan

### 1. Compliance Audit Log Table

Create a new `compliance_audit_log` table to record every legally significant event:

```text
id | uuid PK
user_id | uuid (agent who owns the record)
event_type | text (terms_accepted, proposal_approved, cc_authorized, refund_issued, dispute_opened, cancellation_recorded)
entity_type | text (trip_payment, booking, cc_authorization)
entity_id | uuid
client_name | text
ip_address | text
user_agent | text
signature | text (typed name for e-sign events)
metadata | jsonb (amount, trip name, etc.)
created_at | timestamptz
```

RLS: Agents can view their own logs; admins/office admins can view all.

### 2. IP + User Agent Capture on Approvals

- Update `SharedTripInvestment` to capture the client's IP address when they accept terms
- Use a lightweight IP detection approach (fetch from a public API like `https://api.ipify.org`)
- Pass IP + user agent + signature to the `shared-trip` edge function
- The edge function writes to `compliance_audit_log` and updates `trip_payments.terms_accepted_at` + `acceptance_signature`
- Also capture IP on CC authorization submissions (update `cc-authorization` edge function)

### 3. Refund Tracking Dashboard

Create a new admin-only page `/refunds` (or a section within QBO Health) showing:

- All `trip_payments` with `status = 'refunded'` across the agency
- Columns: Date, Client, Trip, Amount, Refund Reason, Agent, Stripe Receipt
- Summary cards: Total Refunds (count + amount), This Month, By Agent
- Filter by date range and agent
- Link to Stripe receipt URL when available

### 4. Chargeback Alert Workflow

- Add a new webhook handler in `stripe-issuing-webhook` (or a separate function) for `charge.dispute.created` events
- When a dispute is received:
  - Create an `agent_notification` with type `chargeback_alert`
  - Log to `compliance_audit_log` with event_type `dispute_opened`
  - Update the corresponding `trip_payment` status to `disputed` (add as a new valid status)
- Dashboard: Show disputed payments in the refund tracking view with a red "Disputed" badge

### 5. Supplier Cancellation Tracking

Add structured cancellation fields to the `bookings` table:

```text
cancelled_at | timestamptz
cancellation_penalty | numeric (default 0)
cancellation_refund_amount | numeric (default 0)
cancellation_reason | text
```

- When a booking status changes to `cancelled`, prompt the agent for cancellation details (penalty, refund amount, reason)
- Show a cancellation details card on `BookingDetail` when status is cancelled
- Add a "Supplier Cancellations" section to the refund tracking page showing all cancelled bookings with financial impact

---

## Database Changes

```sql
-- 1. Compliance audit log
CREATE TABLE public.compliance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  client_name text,
  ip_address text,
  user_agent text,
  signature text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON public.compliance_audit_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audit logs"
  ON public.compliance_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs"
  ON public.compliance_audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admins can view all audit logs"
  ON public.compliance_audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'office_admin'::app_role));

-- 2. Supplier cancellation fields on bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_penalty numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_refund_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- 3. Index for audit log queries
CREATE INDEX idx_compliance_audit_event_type ON public.compliance_audit_log(event_type);
CREATE INDEX idx_compliance_audit_user_id ON public.compliance_audit_log(user_id);
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/RiskCompliance.tsx` | Refund tracking dashboard + compliance audit trail + supplier cancellations |
| `src/hooks/useComplianceAudit.ts` | Hook to query compliance_audit_log and refund data |
| `supabase/functions/stripe-dispute-webhook/index.ts` | Webhook handler for Stripe dispute events |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/shared-trip/SharedTripInvestment.tsx` | Capture IP + user agent on terms acceptance, POST to shared-trip edge function |
| `supabase/functions/shared-trip/index.ts` | Accept POST with signature/IP/user_agent, write to compliance_audit_log |
| `supabase/functions/cc-authorization/index.ts` | Log IP + user agent to compliance_audit_log on CC auth submission |
| `src/pages/BookingDetail.tsx` | Add cancellation details dialog when status changes to cancelled; show cancellation card |
| `src/hooks/useBookings.ts` | Add cancellation fields to Booking interface and select query |
| `src/components/layout/Sidebar.tsx` | Add "Risk & Compliance" nav item for admins |
| `src/App.tsx` | Add `/risk-compliance` route |
| `src/integrations/supabase/types.ts` | Auto-updated with new table/columns |
| `supabase/config.toml` | Add `stripe-dispute-webhook` with `verify_jwt = false` |

---

## Implementation Order

1. Database migration (compliance_audit_log table + booking cancellation columns)
2. Create `useComplianceAudit` hook
3. Create `RiskCompliance` page with refund dashboard + audit trail + supplier cancellations
4. Add route and sidebar navigation
5. Update `SharedTripInvestment` + `shared-trip` edge function for IP/signature logging
6. Update `cc-authorization` edge function for audit logging
7. Add cancellation details dialog to `BookingDetail`
8. Create `stripe-dispute-webhook` edge function for chargeback alerts
9. Deploy edge functions

