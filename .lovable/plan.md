

# CRM Workflow Verification: Current State vs. Plan

## Summary

The platform already covers approximately **85-90%** of the described workflow. Below is a phase-by-phase breakdown showing what's implemented, what's partially covered, and what's missing.

---

## Phase 1 -- Lead Intake: IMPLEMENTED

| Requirement | Status |
|---|---|
| Website form / webhook integration | Done -- `receive-lead` edge function with unique inbound URL per agent |
| Referral / manual entry | Done -- `AddClientDialog` with full profile fields and status dropdown (Lead/Active/Inactive) |
| Client profile (email, phone, address, passport, notes) | Done -- comprehensive fields including travel IDs, preferences, companions |
| Source tagging (Web, Referral, Partner, Repeat Client) | Partial -- `tags` field exists on clients table but no structured source enum; `webhook_leads` tracks `source` field for inbound leads |
| Lead deduplication | Done -- unique constraint on `user_id` + `lead_id` in `webhook_leads` |

**Gap:** No structured "lead source" dropdown (Web/Referral/Partner/Repeat). Currently free-text tags.

---

## Phase 2 -- Create Trip: IMPLEMENTED

| Requirement | Status |
|---|---|
| New Trip dialog | Done -- `AddTripDialog` with trip name, destination, dates, notes |
| Select client | Partial -- client is assigned at the trip level via `client_id`, but the `AddTripDialog` does not include a client selector; client is typically assigned from the client detail page or via the trip sidebar |
| Trip type (Honeymoon, Family, Luxury, Cruise) | Partial -- only "Regular" and "Group" options exist; no Honeymoon/Family/Luxury/Cruise categories |
| Estimated budget range | Missing -- no budget field on trips table |
| Start/End dates, Destination | Done |

**Gaps:**
- Trip creation dialog lacks inline client selection
- No trip category/type beyond Regular vs Group
- No budget range field

---

## Phase 3 -- Add Trip Components (Bookings): IMPLEMENTED

| Requirement | Status |
|---|---|
| Hotels, Flights, Transfers, Tours, Insurance | Done -- bookings are generic components linked to trips via `trip_id` |
| Supplier name | Done -- supplier selector with auto-populated commission rates |
| Confirmation number | Done -- `booking_reference` field |
| Net cost / Client price | Done -- `gross_sales`, `net_sales`, `supplier_payout` |
| Commission % | Done -- `commission_rate` with supplier-derived or manual rates |
| Cancellation terms | Partial -- available via booking `notes` field, not a dedicated field |
| Payment deadline | Missing -- no dedicated payment deadline per booking component |
| Service fee / Planning fee | Partial -- can be modeled as bookings with custom commission settings, but no dedicated fee type |

**Gaps:**
- No booking "type" field (Hotel/Flight/Transfer/Tour/Insurance/Fee)
- No per-component payment deadline field
- No dedicated cancellation terms field

---

## Phase 4 -- Proposal + Pricing: PARTIALLY IMPLEMENTED

| Requirement | Status |
|---|---|
| Build proposal / itinerary | Done -- itinerary builder with AI generation, cover images, day-by-day items |
| Send to client | Done -- `PublishTripButton` generates shareable link; portal link sending |
| Proposal status tracking (Draft/Sent/Viewed/Approved) | Partial -- `published_at` timestamp exists; `itinerary_approved_at` and `itinerary_approved_by_client_id` exist for approval; no "Viewed" tracking |
| Confirm margin before payment | Done -- Trip Financials card shows gross, commissionable, commission revenue, supplier payout |
| Confirm deposit required | Partial -- payment dialog supports deposits but no formal "deposit required" flag |

**Gaps:**
- No explicit proposal status workflow (Draft -> Sent -> Viewed -> Approved)
- No "viewed" tracking for shared trip links
- No formal deposit requirement toggle

---

## Phase 5 -- Client Payment Flow: IMPLEMENTED

| Requirement | Status |
|---|---|
| Full Payment / Deposit + Final Balance | Done -- `AddPaymentDialog` with payment_type options |
| Stripe payment | Done -- embedded Stripe Checkout and payment link modes |
| Affirm payment | Done -- `AffirmVirtualCardButton` in portal |
| ACH / Wire | Partial -- "Log Manually" mode covers these as external payments |
| Mark invoice as paid | Done -- invoice status tracking with `useInvoices` |
| Record amount received | Done -- `trip_payments` with amount, status, payment_date |
| Attach Stripe transaction ID | Done -- `stripe_session_id`, `stripe_receipt_url` on `trip_payments` |

**Gap:** No dedicated ACH/Wire payment method selector; these are handled as manual logs.

---

## Phase 6 -- Supplier Payment (Virtual Card): IMPLEMENTED

| Requirement | Status |
|---|---|
| Agent requests virtual card | Done -- `StripeVirtualCardButton` with manual "Issue Card" dialog |
| Approval (if required) | Partial -- no formal approval workflow for card issuance; any agent can issue |
| Issue Stripe virtual card | Done -- `create-virtual-card` edge function with MCC restrictions |
| Card auto-locks | Done -- `stripe-issuing-webhook` auto-cancels card after successful transaction |
| Payment confirmation | Done -- `virtual_card_status` tracking on `trip_payments` |
| Mark supplier as "Paid" | Partial -- booking status updates to `confirmed` on transaction; no explicit "Supplier Paid" status |
| Attach invoice | Missing -- no supplier invoice upload/attachment |

**Gaps:**
- No admin approval threshold for card issuance (e.g., $10K+ requires admin)
- No supplier invoice attachment feature

---

## Phase 7 -- Commission Tracking: IMPLEMENTED

| Requirement | Status |
|---|---|
| Commission expected / % / due date | Done -- calculated from booking data; expected date = 30 days before departure |
| Commission received date | Done -- `paid_date` on commissions table |
| Split (advisor % vs host %) | Done -- tier-based splits (Tier 1: 70/30, Tier 2: 80/20, Tier 3: 95/5) |
| Update when received | Done -- commission status updates (pending -> paid) |
| QuickBooks sync on commission received | Done -- `trigger_qbo_commission_received` database trigger |

Fully covered.

---

## Phase 8 -- Accounting Sync (QuickBooks): IMPLEMENTED

| Requirement | Status |
|---|---|
| Client Pays -> Debit Stripe Clearing / Credit AR | Done -- automated via `trigger_qbo_deposit_posted` |
| Supplier Paid -> Debit Expense / Credit Clearing | Done -- `trigger_qbo_booking_confirmed` |
| Commission Split -> Advisor payable | Done -- `trigger_qbo_payout_approved` |
| Stripe Reconciliation Report | Done -- QBO Health page with reconciliation by payout date |
| Auto-provision accounts | Done -- Stripe Clearing + Processing Fees created on first use |

Fully covered with the 3-step journal entry flow.

---

## Phase 9 -- Trip Closeout: PARTIALLY IMPLEMENTED

| Requirement | Status |
|---|---|
| Trip status workflow (Planning -> Booked -> Traveling -> Completed) | Done -- `TripStatusWorkflow` component |
| Archive after completion | Done -- archive option for completed/cancelled trips |
| All supplier payments confirmed | Partial -- virtual card status visible but no formal checklist |
| Final balance paid check | Partial -- payment progress bar shows remaining balance |
| Commission schedule logged | Done -- commission history with expected dates |
| Refunds processed | Missing -- no refund tracking feature |

**Gaps:**
- No formal closeout checklist UI
- No refund tracking
- Status workflow missing "inbound" as a pre-planning stage (though `inbound` exists in `statusColors` on Trips page but not in `TripStatusWorkflow`)

---

## Advanced Controls: PARTIALLY IMPLEMENTED

| Requirement | Status |
|---|---|
| Required invoice upload before supplier payment | Missing |
| Payment approval threshold ($10K+) | Missing |
| Commission aging report | Partial -- expected dates shown but no dedicated aging view |
| Trip profitability dashboard | Partial -- Trip Financials card + Analytics page |
| Payment deadline reminders | Missing |
| Automatic task creation on deposit receipt | Missing |

---

## Recommended Next Steps (Priority Order)

1. **Add booking type field** -- Add a `booking_type` enum (Flight, Hotel, Cruise, Transfer, Tour, Insurance, Fee) to the bookings table and add it to the booking creation dialog. This is the most impactful structural gap.

2. **Add client selector to trip creation** -- Include a client dropdown in `AddTripDialog` so trips can be linked to a client at creation time.

3. **Add trip category/tags** -- Expand trip type beyond Regular/Group to include Honeymoon, Family, Luxury, Cruise, Adventure, etc.

4. **Closeout checklist** -- Add a simple checklist component to the Trip Detail page (all suppliers paid, commissions tracked, balance settled, notes archived) that agents can check off before marking a trip complete.

5. **Supplier invoice attachment** -- Add file upload to booking components for supplier invoices/confirmations.

6. **Payment approval threshold** -- Add admin-configurable threshold where virtual card issuance above a certain amount requires admin approval.

7. **Refund tracking** -- Add refund records linked to trip_payments with reason and status.

---

## Technical Implementation Notes

- Booking type field: new migration adding `booking_type text DEFAULT 'other'` to bookings table; update `AddBookingDialog`, `AddTripBookingDialog`, `EditBookingDialog`
- Client selector in trip dialog: add client dropdown using existing `useClients` hook; set `client_id` on trip creation
- Trip categories: add `trip_category text` column to trips; update `AddTripDialog` with category selector
- Closeout checklist: pure frontend component reading existing trip data (payments, bookings, commissions) to show completion status
- Supplier invoice: new storage bucket `supplier-docs` + `supplier_invoice_url` column on bookings
- Refund tracking: new `trip_refunds` table with RLS policies matching trip_payments patterns

