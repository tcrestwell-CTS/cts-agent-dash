# Repair agent-signup payment approval

## Goal
Stop completed subscription checkouts from disappearing when the payer email differs or a delayed payment has not settled, and safely finish Elvira Cruz's onboarding only after confirming the actual payment state.

## Implementation
1. **Make new approval links traceable in CTN-Hosting**
   - Put the application UUID in the Checkout Session, subscription, and customer metadata.
   - Store the Stripe customer, payment-link/session, and subscription identifiers on the application when they become available.
   - Keep email matching only as a backward-compatible fallback, using normalized email values.

2. **Make webhook processing reliable and payment-aware**
   - Use one idempotent fulfillment routine for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `invoice.paid`.
   - Approve immediately only when Stripe reports the Checkout payment as paid; for delayed methods, record the completed-but-pending state and wait for the success event.
   - Record failed async payments and payment failures without activating the applicant.
   - Return a retryable error when account creation fails instead of acknowledging and silently losing the event.

3. **Add an admin-visible reconciliation safety net**
   - Record every agent-signup Stripe event, its application/customer/session/subscription IDs, match method, payment state, attempt count, result, and last error in a restricted reconciliation table.
   - Deduplicate by Stripe event ID and make account creation idempotent by application/subscription ID.
   - Send a clear alert to `tcrestwell@crestwellgetaways.com` for unmatched or failed records.
   - Add a scheduled daily reconciliation pass for unresolved records so transient failures are retried and mismatches remain visible.

4. **Harden this project's `ctn-approve` function**
   - Validate and normalize its input, accept Stripe/application identifiers, and persist the agent subscription identifiers when the account exists.
   - Make invitation, role, profile, subscription, and email actions safe to repeat.
   - Stop reporting success when required account or welcome-email work fails; keep document delivery retryable.

5. **Complete and verify Elvira Cruz**
   - Confirm her latest Stripe invoice is actually paid, not merely an active subscription with an unpaid/processing first invoice.
   - Run the same idempotent approval path for application `e9f4c408-b173-44b7-848e-12c55410fd3f` and subscription `sub_1UEqRwPJljF0WNcYyCsETYL2`.
   - Create or repair her invitation/profile/agent role and subscription record, update the application payment fields, and send the normal activation/onboarding email once.
   - Verify the invitation, CRM record, subscription mapping, email result, and reconciliation status.

## Technical constraint
The current workspace contains the CRM function, but the named `CTN-Hosting` repository and its `ctn_applications` database are not connected here. The systemic webhook changes and the application update require that repository/project to be connected or checked out. Work available here can proceed on `ctn-approve`; Elvira's external application row cannot be marked paid from this database alone.
