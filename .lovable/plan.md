

# Level 2: Upgrade the Client Experience

Transform the client portal from functional to premium, and make the proposal page feel like a luxury microsite.

---

## What Already Exists

**Client Portal (PortalTripDetail):**
- Trip header with name, destination, dates, status badge
- Itinerary options with approve/request changes
- Bookings list with confirmation gate (locked until deposit paid)
- Payments list with "Pay Now" buttons (Stripe)
- Payment Milestone Tracker (progress bar + milestone list)
- CC Authorizations section
- Trip notes

**Proposal Page (SharedTrip):**
- Hero cover photo (full-width 40vh)
- Agency branding bar with advisor card + video embed
- Trip meta (name, destination, dates, cost, type)
- Day-by-day itinerary with category icons
- Investment breakdown (total cost, deposit, balance, deadlines)
- "What's Included" / "Not Included" lists
- Urgency banner + optional upgrades
- Pre-payment agreement dialog (3 checkboxes)
- Footer with agency info

---

## Part 1: Client Portal Enhancements

### 1A. Departure Countdown
- Add a prominent countdown card at the top of `PortalTripDetail` and on `PortalDashboard` trip cards
- Shows days until departure with visual ring/number
- Changes tone: "X days to go!" (far out) vs "Departing soon!" (under 7 days) vs "You're traveling!" (during trip)
- Pure frontend calculation from `depart_date`, no database changes

### 1B. Balance Reminder Progress Bar
- Already exists as `PaymentMilestoneTracker` -- enhance it to be more prominent
- Move it higher on the `PortalTripDetail` page (right after the trip header)
- Add a colored urgency state: green (on track), amber (payment due soon), red (overdue)
- Add remaining balance callout text: "You have $X,XXX remaining -- next payment due MMM D"
- Also show a mini version on `PortalDashboard` per trip

### 1C. Document Checklist
- Create a new component `TravelDocChecklist` showing:
  - Passport valid for travel (checkbox)
  - Travel insurance obtained (checkbox)
  - Visa requirements reviewed (checkbox)
  - Emergency contacts provided (checkbox)
- Client-side state stored via the portal-data edge function
- New database table `client_document_checklist` with columns: `id`, `client_id`, `trip_id`, `item_key`, `is_checked`, `created_at`, `updated_at`
- Edge function endpoint to read/update checklist items

### 1D. Emergency Contact Button
- Add a floating or sticky "Need Help?" button in the portal layout
- Tapping it shows the agent's phone number, email, and a quick-message form
- Uses existing agent data from the portal session -- no database changes

### 1E. Interactive Itinerary Map (Simplified)
- Add a visual location timeline instead of a full map (avoids needing Google Maps API key)
- Show destinations as connected dots on a horizontal timeline with location labels
- Derived from itinerary item locations -- no database changes
- If a map API is later desired, the component can be upgraded

---

## Part 2: Proposal Page Enhancements (Luxury Microsite)

### 2A. Enhanced Hero
- Trip name overlaid on the cover photo with gradient text shadow
- Destination + dates shown over the image
- Smoother gradient overlay (from-black/60 via-black/30 to-transparent)
- Already has cover photo -- just need to overlay trip info on it

### 2B. Payment Timeline Visual
- Add a horizontal timeline component showing the payment schedule
- Deposit -> Interim payments -> Final balance with dates and amounts
- Visual dots connected by a line, colored by status
- Rendered from existing `paymentDeadlines` data

### 2C. Secure Approval + E-Sign Enhancement
- Upgrade the existing "Review Terms & Proceed" flow
- Add a typed signature field (client types their name as agreement)
- Add timestamp + IP capture for the acceptance record
- Store signature in the existing `terms_accepted_at` field + a new `acceptance_signature` text field on `trip_payments`
- Update the shared-trip edge function to accept and store the signature

---

## Database Changes

```sql
-- Document checklist for client portal
CREATE TABLE client_document_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  trip_id uuid NOT NULL,
  item_key text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, trip_id, item_key)
);

ALTER TABLE client_document_checklist ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed for direct access since this is accessed
-- via service-role through the portal-data edge function

-- Acceptance signature for proposals
ALTER TABLE trip_payments ADD COLUMN IF NOT EXISTS acceptance_signature text;
```

---

## New Files

| File | Purpose |
|------|---------|
| `src/components/client/DepartureCountdown.tsx` | Countdown to departure date |
| `src/components/client/TravelDocChecklist.tsx` | Document checklist with checkboxes |
| `src/components/client/EmergencyContactButton.tsx` | Floating help/contact button |
| `src/components/client/ItineraryLocationTimeline.tsx` | Visual location dots timeline |
| `src/components/shared-trip/PaymentTimelineVisual.tsx` | Horizontal payment schedule timeline |

## Modified Files

| File | Changes |
|------|---------|
| `src/pages/client/PortalDashboard.tsx` | Add departure countdown per trip, mini balance bar |
| `src/pages/client/PortalTripDetail.tsx` | Add countdown, enhanced balance bar, doc checklist, location timeline |
| `src/components/client/PortalLayout.tsx` | Add emergency contact floating button |
| `src/components/client/PaymentMilestoneTracker.tsx` | Add urgency colors + remaining balance text |
| `src/pages/SharedTrip.tsx` | Overlay trip info on hero, add payment timeline |
| `src/components/shared-trip/SharedTripInvestment.tsx` | Add typed e-signature field to agreement dialog |
| `src/components/shared-trip/SharedTripMeta.tsx` | Minor: move into hero overlay when cover exists |
| `src/hooks/usePortalData.ts` | Add checklist fetch/update hooks |
| `supabase/functions/portal-data/index.ts` | Add checklist read/write endpoints |

## Implementation Order

1. Database migration (checklist table + signature column)
2. Departure Countdown component + integrate into portal dashboard and trip detail
3. Enhanced Payment Milestone Tracker (urgency colors, remaining balance)
4. Document Checklist (component + edge function endpoints)
5. Emergency Contact Button in portal layout
6. Location Timeline for itinerary
7. Proposal hero overlay enhancement
8. Payment Timeline Visual for proposal page
9. E-signature field in proposal agreement dialog

