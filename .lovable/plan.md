
# Level 1: Tighten the Workflow -- Reduce Friction and Risk

This plan addresses four handoff points in the Crestwell Workflow, adding data-driven guardrails at each stage.

---

## What Already Exists

Before building, here is what the platform already has:
- **Lead -> Trip**: Basic trip creation with client selector, budget range, trip type, and dates
- **Proposal -> Approval**: SharedTripInvestment with deposit/balance breakdown, cancellation terms, pre-payment agreement with 3 checkboxes
- **Payment -> Supplier Payment**: Virtual card issuance with invoice upload requirement, auto-lock after charge, Stripe balance validation via issuing webhook
- **Commission Layer**: Expected commission dates (30 days before departure), tier-based splits, agent breakdown, CSV export, monthly trend chart

---

## 1. Lead to Trip -- Speed Layer

### Database Changes
Add new columns to the `trips` table:
```sql
ALTER TABLE trips ADD COLUMN IF NOT EXISTS readiness_score jsonb DEFAULT '{}';
```

The `readiness_score` column will store a JSON object like:
```json
{
  "budget_confirmed": true,
  "dates_confirmed": false,
  "supplier_checked": false,
  "margin_confirmed": false
}
```

### New: Auto-Create Trip Draft on Lead Conversion
- In the CRM page, when a lead's status changes to "active", show a prompt: **"Create a trip for this client?"**
- If accepted, open `AddTripDialog` pre-filled with the client's ID, name, and any known preferences
- This is a UI-only change in `EditClientDialog` or the status-change handler in CRM

### New: Trip Readiness Score Card
- Create `src/components/trips/TripReadinessScore.tsx`
- A sidebar card on the Trip Detail page showing 4 checklist items:
  - **Budget confirmed** -- checked when `budget_range` is set
  - **Dates confirmed** -- checked when both `depart_date` and `return_date` are set
  - **Supplier availability checked** -- checked when at least 1 booking exists with a supplier assigned
  - **Margin confirmed** -- checked when `total_commission_revenue > 0`
- Display as a circular progress ring with percentage and individual check items
- When all 4 are green, show a "Ready for Proposal" badge

### New: Proposal Gate
- In `TripStatusWorkflow`, when advancing from "planning" to "booked", check the readiness score
- If any items are unchecked, show a warning dialog: "This trip has incomplete readiness items. Proceed anyway?"
- This prevents messy proposals from going out

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/components/trips/TripReadinessScore.tsx` | Create -- readiness score card component |
| `src/pages/TripDetail.tsx` | Modify -- add TripReadinessScore to right sidebar |
| `src/components/trips/TripStatusWorkflow.tsx` | Modify -- add readiness gate before status advance |
| `src/pages/CRM.tsx` or `src/components/crm/EditClientDialog.tsx` | Modify -- add auto trip-creation prompt on lead conversion |

---

## 2. Proposal to Approval -- Conversion Layer

### New: Urgency Banner
- In `SharedTripInvestment`, add an amber banner at the top: "Pricing is subject to availability and may change. Book now to secure these rates."
- Conditionally shown when the trip is in "planning" status

### New: Optional Upgrades Section
- Add an "Optional Upgrades" section to the shared trip page between the investment breakdown and the "Ready to Book" CTA
- Data source: bookings on the trip with a new `is_upgrade` flag, or a simpler approach using trip notes/tags
- For now, implement as a static section that agents can populate via trip settings (a text area for upgrade descriptions)

### New: Advisor Video Intro
- Add a `video_intro_url` column to `branding_settings` table
- In the shared trip page hero (`SharedTripHero`), if the agent has a video URL configured, embed it as an optional iframe or link
- Simple embed: YouTube/Vimeo URL rendered in an iframe

### New: Follow-Up Reminders
- Add a `follow_up_reminders` table to track scheduled follow-ups
- Database trigger: When a trip is published but not approved within 48 hours, insert a reminder notification into `agent_notifications`
- This uses the existing notification bell system

### Database Changes
```sql
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS video_intro_url text;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS upgrade_notes text;
```

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/components/shared-trip/SharedTripInvestment.tsx` | Modify -- add urgency banner |
| `src/components/shared-trip/SharedTripHero.tsx` | Modify -- add advisor video embed |
| `src/pages/SharedTrip.tsx` | Modify -- pass upgrade notes, render upgrades section |
| `src/components/trips/TripSettingsSidebar.tsx` | Modify -- add upgrade notes and video URL fields |
| Migration | Add `video_intro_url` to branding_settings, `upgrade_notes` to trips |

---

## 3. Payment to Supplier Payment -- Risk Layer

### What Already Exists
- Invoice upload requirement before virtual card issuance (enforced in Stripe Issuing flow)
- Auto-lock cards after charge (stripe-issuing-webhook)
- Balance validation in issuing authorization requests

### New: Supplier Payment Status Dashboard
- Create `src/components/trips/SupplierPaymentStatus.tsx`
- A card on the Trip Detail page (within Bookings tab or as a new tab) showing per-booking:
  - Booking reference and supplier name
  - Invoice uploaded (yes/no)
  - Virtual card status (not issued / pending / ready / authorized / locked)
  - Payment amount vs. authorized amount
- Color-coded rows: green = paid, yellow = pending, red = overdue

### New: Funding Confirmation Gate
- In the virtual card creation flow (`StripeVirtualCardButton`), before issuing a card, display the current Stripe Issuing balance
- If insufficient funds, show a warning and block card creation
- This calls the existing `retrieve-virtual-card` edge function or a new balance check

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/components/trips/SupplierPaymentStatus.tsx` | Create -- supplier payment dashboard per trip |
| `src/pages/TripDetail.tsx` | Modify -- add supplier payment status to bookings tab |
| `src/components/trips/StripeVirtualCardButton.tsx` | Modify -- add funding confirmation check |

---

## 4. Commission Layer -- Profit Control

### What Already Exists
- Commission expected date (30 days before departure) with countdown
- Tier-based splits with agent/agency breakdown
- Monthly earnings trend chart

### New: Commission Aging Report
- Add a new section to the Commissions page showing commissions grouped by age:
  - 0-30 days, 31-60 days, 61-90 days, 90+ days overdue
- Only for "pending" commissions past their expected date
- Visual: horizontal bar chart or simple table with color-coded aging buckets

### New: Commission Variance Tracking
- Add `expected_commission` column to `commissions` table
- When a commission is created, auto-populate `expected_commission` based on supplier rate and commissionable amount
- On the Commissions page, show a variance column: `Received - Expected`
- Highlight negative variances in red

### New: Margin Per Trip
- On the Trip Detail financials card, add a "Margin %" row:
  - `(total_commission_revenue / total_gross_sales) * 100`
- Simple calculation, no database changes needed

### New: Advisor Profitability Dashboard
- On the Commission Report page (admin only), add a summary section:
  - Per agent: total gross sales, total commission, margin %, number of trips
  - Sortable columns
  - This extends the existing `agentBreakdown` in the Commissions page with margin calculations

### Database Changes
```sql
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS expected_commission numeric DEFAULT 0;
```

### Files to Create/Modify
| File | Action |
|------|--------|
| Migration | Add `expected_commission` to commissions |
| `src/pages/Commissions.tsx` | Modify -- add aging report section and variance column |
| `src/pages/TripDetail.tsx` | Modify -- add margin % to financials card |
| `src/pages/CommissionReport.tsx` | Modify -- add advisor profitability summary |
| `src/hooks/useCommissions.ts` | Modify -- include expected_commission in queries |

---

## Summary of Database Migrations

```sql
-- Single migration for all Level 1 changes
ALTER TABLE trips ADD COLUMN IF NOT EXISTS readiness_score jsonb DEFAULT '{}';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS upgrade_notes text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS video_intro_url text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS expected_commission numeric DEFAULT 0;
```

## Implementation Order

1. Database migration (single migration for all new columns)
2. Trip Readiness Score + Proposal Gate (Level 1.1)
3. Auto trip creation on lead conversion (Level 1.1)
4. Urgency banner + upgrade notes + video intro (Level 1.2)
5. Supplier Payment Status dashboard (Level 1.3)
6. Margin per trip + Commission aging + variance (Level 1.4)
7. Advisor profitability dashboard (Level 1.4)

## New Files (4)
- `src/components/trips/TripReadinessScore.tsx`
- `src/components/trips/SupplierPaymentStatus.tsx`
- `src/components/commissions/CommissionAgingReport.tsx`
- 1 database migration

## Modified Files (~12)
- `src/pages/TripDetail.tsx`
- `src/components/trips/TripStatusWorkflow.tsx`
- `src/pages/CRM.tsx` or `src/components/crm/EditClientDialog.tsx`
- `src/components/shared-trip/SharedTripInvestment.tsx`
- `src/components/shared-trip/SharedTripHero.tsx`
- `src/pages/SharedTrip.tsx`
- `src/components/trips/TripSettingsSidebar.tsx`
- `src/components/trips/StripeVirtualCardButton.tsx`
- `src/pages/Commissions.tsx`
- `src/pages/CommissionReport.tsx`
- `src/hooks/useCommissions.ts`
