# Group Booking Wizard (Celebrity-style) — bring in the uploaded template

Add the public step-by-step group booking page (Party Size, Room Selection, Add-ons, Review, Guest Info, Pay) and the advisor setup screen, based on the uploaded files, adjusted to fit this app's payment and security rules.

## What the uploads contain vs. what's missing
Uploaded (5 of the 12 files described): the booking page, the setup page, the `group-booking` function, the shared pricing module, and the migration.
Not uploaded, so they will be written here to match the description: the Stripe webhook `group_deposit` branch, the `group-signup` / landing page "Join This Trip" switch to the wizard, the new routes, the "Booking wizard setup" link in the landing page builder, and the pricing unit test ($886 x 2 = $1,772).

## Changes needed before it can go live
1. **Right Stripe account.** The template charges with `STRIPE_SECRET_KEY` (the old account used for loans and subscriptions). Group deposits are client payments, so they will use `STRIPE_SECRET_KEY_CLIENT` and the pinned new-account publishable key. No new publishable-key secret is needed.
2. **Database access grants.** The migration creates `trip_addons` and `group_bookings` with no GRANT statements, so the app couldn't read them. Grants will be added: advisors can manage their own trips' records, the backend gets full access, and the public gets nothing (the public page reads only through the function).
3. **Project conventions.** Change the function to `Deno.serve` and `npm:@supabase/supabase-js@2` instead of the esm.sh / std imports. Use `parseLocalDate` for dates.
4. **Payment trail.** The paid deposit writes a `trip_payments` row and uses `trip_id` / `trip_payment_id` metadata so QBO sync, reminders, and reconciliation see it the same way as other client payments. Loan and subscription webhook paths stay untouched.

## Pre-existing bugs from the notes
- **stripe-webhook**: confirmed. `stripeFee` is used inside `applyTripInstallmentPayment` (line 289) but isn't defined there, so every installment payment through the webhook would throw. Fix: read the fee from the PaymentIntent's charge inside that function.
- **create-payment-intent**: the stray `.maybeSingle()` isn't in this project's copy. The file parses as it is, so no change.

## Steps
1. Run the migration with grants and access rules added.
2. Add the shared pricing module and a unit test for the Celebrity example.
3. Add the `group-booking` function (config, server-side quote, submit creating client/sub-trip/booking/travelers/PaymentIntent on the client account) and deploy it.
4. Add the `group_deposit` webhook branch, fix the `stripeFee` bug, and deploy.
5. Add routes `/group/:token/book` (public) and `/trips/:id/booking-setup` (advisor), plus the setup link in the landing page builder.
6. When the wizard is set to Live, the landing page's Join This Trip goes to the wizard. Otherwise the current modal stays.
7. Check it: run the pricing test, go through the wizard in the browser up to the Pay step without charging a card (Stripe is live), and confirm the setup tabs save.

## Technical notes
- The public function is rate-limited, validates input with zod, and recalculates price on the server. The price the client sends is never trusted.
- Room inventory is checked against `group_cabin_option_usage` at submit time.
- Record the architecture rule in AGENTS.md.
