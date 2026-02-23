

# Premium Client Journey Enhancement Plan

## Current Coverage Assessment

The platform already implements approximately 75% of this client journey. Here's what exists and what needs to be built.

## What's Already Built

- **Trip Preview/Proposal**: Published trip page with itinerary, cover images, advisor card, certifications
- **Itinerary Approval**: Client can approve/switch between itinerary options in the portal
- **Payment Flow**: Stripe checkout, Affirm financing, payment links, manual logging, deposits, final balance
- **Client Dashboard**: Trip overview, pending payments, unread messages, agent card
- **Payment History**: Full transaction table with receipts, status badges, Pay Now buttons
- **Booking Visibility**: Clients can see bookings with status and amounts
- **CC Authorization**: Signature capture, Terms acknowledgment, card data collection
- **Messaging**: Real-time portal messaging between agent and client
- **Invoices**: PDF generation, portal viewing, email delivery
- **Virtual Cards**: Auto-issued on Stripe payment, Affirm VCN capture, agent retrieval

## What's Missing (Prioritized)

### Priority 1: Investment Breakdown on Shared Trip Page
The public proposal page currently shows total cost but lacks a structured pricing breakdown showing deposit amount, final payment due date, what's included/excluded, and cancellation terms.

**Changes:**
- Update `shared-trip` edge function to return pricing breakdown data (deposit amount, payment schedule, inclusions/exclusions from trip notes)
- Add a new `SharedTripInvestment` component showing Total Trip Cost, Deposit Due, Final Payment Due Date, What's Included, What's Not Included
- Add cancellation policy section from booking `cancellation_terms`

### Priority 2: "Request Changes" Button on Portal Trip Detail
Clients can only approve itineraries but cannot request changes. Need a simple mechanism to send a change request message to the agent.

**Changes:**
- Add "Request Changes" button next to the Approve button on each itinerary option in `PortalTripDetail.tsx`
- When clicked, show a text input dialog for the client to describe requested changes
- Submit as a portal message (type: `change_request`) and notify the agent

### Priority 3: Pre-Payment Agreement/Terms Acceptance
Currently, CC authorization has terms acceptance but there's no general terms agreement step before paying via Stripe/Affirm. The client should acknowledge cancellation policy and confirm traveler names before payment.

**Changes:**
- Add a `PaymentAgreementStep` component shown in the portal before the payment method selection dialog
- Require checkbox acknowledgment of: cancellation policy, traveler names match passports, total trip cost
- Store acceptance timestamp on the trip_payments record via a new `terms_accepted_at` column

### Priority 4: Confirmation Details Gate (Post-Payment Access Control)
Currently, all trip data is visible regardless of payment status. The plan requires that final confirmation numbers and transfer details are hidden until deposit is paid.

**Changes:**
- Add `deposit_required` boolean and `deposit_amount` numeric columns to `trips` table
- In `PortalTripDetail`, conditionally hide booking confirmation numbers and detailed booking info when no deposit payment is recorded
- Show a "Pay deposit to unlock full trip details" banner instead

### Priority 5: Post-Trip Automation (Review + Referral)
After trip completion, automatically request a review and referral from the client.

**Changes:**
- Add a `post_trip_email_sent` boolean column to `trips`
- Create a trigger or scheduled function that sends a branded "How was your trip?" email with a review link when trip status changes to `completed`
- Include a referral request with a shareable link

### Priority 6: Payment Milestone Progress in Portal
Clients see individual payments but lack a visual milestone tracker showing deposit paid, second payment due, final balance due.

**Changes:**
- Add a `PaymentMilestoneTracker` component to `PortalTripDetail`
- Show a visual progress bar with milestone markers (Deposit, Interim Payments, Final Balance)
- Highlight the current milestone and upcoming due dates

---

## Technical Details

### Database Changes (Single Migration)

```text
ALTER TABLE trips
  ADD COLUMN deposit_required boolean DEFAULT false,
  ADD COLUMN deposit_amount numeric DEFAULT 0;

ALTER TABLE trip_payments
  ADD COLUMN terms_accepted_at timestamptz;

ALTER TABLE trips
  ADD COLUMN post_trip_email_sent boolean DEFAULT false;
```

### Files to Create
- `src/components/shared-trip/SharedTripInvestment.tsx` -- Pricing breakdown for public proposal
- `src/components/client/PaymentAgreementStep.tsx` -- Terms acceptance before payment
- `src/components/client/PaymentMilestoneTracker.tsx` -- Visual milestone progress bar
- `src/components/client/RequestChangesDialog.tsx` -- Change request message dialog

### Files to Modify
- `supabase/functions/shared-trip/index.ts` -- Return pricing/payment schedule data
- `src/pages/SharedTrip.tsx` -- Render investment breakdown
- `src/pages/client/PortalTripDetail.tsx` -- Add Request Changes button, agreement gate, milestone tracker, confirmation gate
- `src/pages/client/PortalPayments.tsx` -- Add agreement step before payment method dialog
- `src/components/trips/TripSettingsSidebar.tsx` -- Add deposit required toggle
- `src/pages/TripDetail.tsx` -- Add deposit configuration fields

### Edge Function Changes
- Update `shared-trip` to include payment schedule, cancellation terms, and inclusion/exclusion data from bookings
- Add post-trip email template to `send-email` function

### Sequencing
1. Database migration (new columns)
2. Investment breakdown on shared trip (public-facing, no auth needed)
3. Request Changes dialog in portal
4. Payment agreement step
5. Confirmation details gate
6. Payment milestone tracker
7. Post-trip email automation

