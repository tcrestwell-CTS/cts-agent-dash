## Goal
Capture an IP-logged audit trail for every CRM payment action, and surface it in an admin "Payment Security" tab.

## 1. Align the schema with the spec
The migration I just ran created `payment_ip_logs` but used different column names than your spec. I'll add a follow-up migration adding the missing columns so the API matches what you described:

- `page TEXT` — function/page name (e.g. `create-payment-intent`)
- `last_four TEXT`
- `client_id UUID`
- `booking_id UUID`
- `flagged BOOLEAN GENERATED` — true when `risk_flags` is non-empty
- `flag_reason TEXT[]` — alias view over `risk_flags` (kept as a column for the UI badge)

Indexes added: `page`, `client_id`, `booking_id`, `flagged`.

## 2. Shared helper: `supabase/functions/_shared/payment-ip-log.ts`
One reusable function so every edge function logs identically:

```ts
logPaymentAttempt(req, {
  page: "create-payment-intent",
  amount_cents, stripe_pm_id, last_four,
  client_id, booking_id, customer_email,
  outcome: "attempted" | "succeeded" | "failed" | "blocked",
});
```

Behavior:
- Extracts IP from `cf-connecting-ip` → `x-real-ip` → first of `x-forwarded-for`
- Extracts country from `cf-ipcountry` → `x-vercel-ip-country`
- Inserts via service-role client
- Wrapped in try/catch, **never throws, never awaited in critical path** (returns a fire-and-forget promise the caller can ignore)

## 3. Instrument the payment edge functions
Add `logPaymentAttempt` calls at three checkpoints (attempted on entry, succeeded/failed/blocked on result) in:

- `create-payment-intent`
- `create-flight-payment-intent`
- `create-stripe-payment`
- `create-affirm-charge`
- `create-payment-plan`
- `create-virtual-card`
- `cc-authorization`
- `activate-autopay`
- `verify-stripe-payment`
- `stripe-webhook` (logs the outcome from webhook events)

Webhook functions that don't receive client IPs (Stripe → server) will log with `ip_address = null` and the Stripe-reported country when available; their value is the `outcome` audit trail.

## 4. Admin UI — Payment Security tab
New route/section under the admin area (likely added to `src/pages/Analytics.tsx` or a new admin page wired into the sidebar — I'll match your existing admin pattern after a quick check):

- New hook `src/hooks/usePaymentIpLogs.ts` — paginated (25/page), filterable
- New page `src/pages/admin/PaymentSecurity.tsx` with:
  - Filter bar: page, outcome, country, date range
  - Table columns: timestamp · page · IP · country · amount · outcome · last4 · client (link) · flags
  - Rows where `flagged = true` rendered with a red row tint and `flag_reason` badges
- Admin-gated via existing `AdminRoute` / `usePermissions`

## Out of scope / assumptions
- Not modifying any payment business logic, only adding telemetry
- Not touching the public site repo's Stripe checkout (separate repo); same helper pattern can be copied there later if you want
- Not adding alerting/notifications on flagged rows in this pass — just the audit + UI
