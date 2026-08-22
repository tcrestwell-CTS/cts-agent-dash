# Shared Bookings with Split Payments

Goal: two (or more) people sharing one cabin stay a **single booking**, but each pays their own half independently.

## How it will work

1. On a booking, the advisor clicks **Split payment between travelers**.
2. Pick payers: any traveler already on the trip, or type a name + email for someone not in the system yet.
3. The booking total is divided **equally by default**, and each share is editable (dollar amounts; totals must add up to the booking total, with a live "remaining" indicator).
4. Each payer gets their own payment schedule (deposit + installments), tagged with their name.
5. Each payer gets **their own Stripe payment link** for their share, but the booking keeps **one shared invoice** listing both shares.
6. The client portal shows the **full booking with both shares visible** — who owes what, who has paid what — and each payer pays only their own tagged installments.
7. Payment reminders go to the individual payer's email for their own overdue share only.

No duplicate bookings, no duplicate cabins, no double-counted gross sales or commission.

## Who can set it up

Any advisor can turn splitting on and manage shares for their own trips and bookings — no admin approval needed. Admins and bookkeepers can do the same across all trips, as they can today.

Advisors also get a preference in their own settings: **default new bookings to split payments** (off by default), plus a default number of payers, so agents who routinely book shared cabins don't have to set it up each time. Whatever the default, the split can always be toggled and edited per booking.



## What changes in the UI

- **Booking card / Trip Payments**: new "Split payment" action, plus a per-payer summary (share, paid, balance).
- **Payment rows**: show a payer chip ("Half — Jane D.") so logged payments are attributable.
- **Log Payment / Add Payment dialog**: payer selector when the booking is split.
- **Invoice**: one invoice with a share breakdown section per payer.
- **Client portal payments**: grouped by payer, both shares visible, "Pay my share" only enables the signed-in payer's rows.

## Technical notes

Database (migration):
- `trip_payments`: add `payer_traveler_id uuid` (FK `trip_travelers`, null allowed), `payer_name text`, `payer_email text`.
- New `booking_payer_shares` table: `id`, `booking_id`, `trip_id`, `user_id`, `traveler_id` (nullable), `payer_name`, `payer_email`, `share_amount numeric`, `notes`, timestamps. GRANTs for `authenticated` + `service_role`; RLS scoped to the owning advisor plus existing admin/bookkeeper policies, matching the pattern used by `booking_travelers`.
- Indexes on `booking_id` and `trip_payments.payer_traveler_id`.

Frontend:
- New hook `useBookingPayerShares` (query + upsert + delete).
- New `SplitPaymentDialog.tsx` under `src/components/trips/` — payer picker (from `useTripTravelers`, or manual name/email), equal-split default, editable amounts, remaining-balance guard, optional installment schedule generation per payer.
- `AddPaymentDialog` / `TripPayments`: payer field wired through `useTripPayments`; payer chip in the payment list.
- Portal (`PortalPayments.tsx`) groups rows by payer and gates the pay action to the signed-in payer's email (falls back to all rows when the booking is not split).

Backend:
- `create-payment` / secure-link generation: pass the payer's email and share to Stripe so the link is scoped to one share, and store the payer on the resulting `trip_payments` row.
- `invoiceGenerator` / invoice edge function: render a per-payer share table on the single invoice.
- `send-payment-reminder`: address the payer directly and only include that payer's outstanding rows.

Financials are untouched: margin, commission, and gross sales continue to read the booking total, so splitting only changes who pays which slice.
