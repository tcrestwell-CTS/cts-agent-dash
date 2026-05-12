## Architecture Directive: CRM as System of Record, QBO Downstream-Only

This plan codifies the new architecture: **the CRM is the only writer to QuickBooks Online**, with separated trip vs. loan payment streams routed by Stripe metadata, and cash-basis loan accounting using Stripe clearing accounts that fund the physical operating bank.

---

### 1. Stripe configuration (one account, separated streams)

Create / standardize two Stripe **Products** (used as routing + reporting handles, not for amounts):

- `Trip Payment` — statement descriptor `CRESTWELL TRIP`
- `Loan Repayment` — statement descriptor `CRESTWELL LOAN`

Every Stripe `PaymentIntent` / Checkout Session created by the CRM must carry metadata:

```
payment_type:    "trip_installment" | "loan_repayment"
trip_id:         <uuid>   (when trip_installment)
loan_id:         <uuid>   (when loan_repayment)
installment_no:  <int>
```

Update `create-stripe-payment` (trip flow) to always stamp `payment_type=trip_installment`, `trip_id`, and the trip-payment installment number. Add a parallel `create-loan-stripe-payment` edge function for loan repayments that stamps `payment_type=loan_repayment`, `loan_id`, `installment_no`, and uses the Loan Repayment Product / descriptor.

The public website (`crestwellgetaways.com`) does **not** create Stripe sessions for trips or loans. Any payments taken there are logged manually into the CRM as `trip_payments` rows by staff; the CRM trigger then pushes to QBO. Document this in the public-site repo's README so no one re-introduces a direct Stripe→QBO path.

---

### 2. QBO chart of accounts — Stripe clearing pattern

We will treat the three "deposit accounts" as **Stripe clearing accounts** (Other Current Asset → OtherCurrentAssets), then transfer to the operating bank when each Stripe payout posts.

Add three QBO accounts (created in QBO by the user, then synced via existing `qbo-cache-sync`):

| Account                          | Type                | Purpose                                                  |
|----------------------------------|---------------------|----------------------------------------------------------|
| Trip Stripe Clearing             | Other Current Asset | Receives trip installment payments (already exists as "Stripe Clearing" — rename or reuse) |
| Loan Principal Clearing          | Other Current Asset | Receives principal portion of loan repayments            |
| Loan Interest Clearing           | Other Current Asset | Receives interest portion of loan repayments             |
| Loan Receivable                  | Other Current Asset | Outstanding loan principal balance                       |
| Interest / Financing Income      | Other Income        | (Already exists) Credited when interest portion posts    |

Persist the chosen QBO `qbo_id` for each clearing/receivable/income account in a new `qbo_account_mappings` table (key → `qbo_account_id`) so trigger logic isn't hard-coded to names. Provide a small admin UI under Settings → QBO to pick each role from the synced `qbo_accounts` list.

Vendor expenses continue to draw from the **operating bank** (after the Trip clearing transfer), never from the loan clearing accounts. Enforce this in the supplier-payment push logic.

---

### 3. Stripe webhook → CRM (the only ingress)

Refactor `stripe-webhook` so that on `checkout.session.completed` / `payment_intent.succeeded` it routes by `metadata.payment_type`:

- `trip_installment` → mark matching `trip_payments` row `paid` (existing path).
- `loan_repayment` → mark matching `loan_payment_schedules` row `paid` by `(loan_application_id, payment_number)`, set `paid_date`, store `stripe_payment_intent_id`.

The webhook **does not** call QBO directly. All QBO pushes happen from DB triggers reacting to the CRM row updates (existing pattern via `qbo-sync-trigger`).

---

### 4. CRM → QBO triggers (cash basis)

Extend `qbo-sync-trigger` and add the DB triggers below. Each push writes a `qbo_sync_logs` row with idempotency key `{trigger_type}:{record_id}` and exponential-backoff retry on failure.

| CRM event                                               | QBO push                                                                 | Status |
|---------------------------------------------------------|--------------------------------------------------------------------------|--------|
| `clients` insert                                        | Create QBO Customer                                                      | new    |
| `suppliers` insert                                      | Create QBO Vendor                                                        | new    |
| `trip_payments` scheduled (status=`pending`, due_date)  | No QBO push — schedule lives in CRM only                                 | enforce |
| `loan_payment_schedules` insert                         | No QBO push — schedule lives in CRM only                                 | enforce |
| `trip_payments` → `paid`                                | Sales Receipt + Bank Deposit into **Trip Stripe Clearing**               | exists, retarget account |
| `loan_payment_schedules` → `paid`                       | **Linked pair** of Bank Deposits (see §5)                                | new    |
| `bookings` supplier_paid_status → `paid`                | Expense (Purchases/Expenses) drawn from **operating bank**, not Bills    | exists, confirm account |
| `trips` → `completed`                                   | Commission Journal Entry                                                 | exists |
| `commissions` → `paid`                                  | Commission Deposit                                                       | exists |
| `agent_payouts` override_approved=true                  | Agent Payout Bill                                                        | exists |

Remove / disable any path that writes to QBO from the public site or from a Stripe webhook directly. The Stripe webhook only mutates CRM rows; the row mutation triggers the QBO push.

---

### 5. Loan repayment QBO push (cash basis, atomic pair)

When a `loan_payment_schedules` row flips to `paid`, the new `qbo-sync-trigger` handler `loan_repayment_posted`:

1. Loads the schedule row (`principal_amount`, `interest_amount`, `loan_application_id`, `payment_number`).
2. Loads `qbo_account_mappings` for `loan_principal_clearing`, `loan_interest_clearing`, `loan_receivable`, `interest_income`.
3. Creates **two QBO Bank Deposits** in one logical unit:
   - **Principal Deposit** — Deposit account: Loan Principal Clearing. Source line: credit Loan Receivable (reduces the asset). Amount: `principal_amount`.
   - **Interest Deposit** — Deposit account: Loan Interest Clearing. Source line: credit Interest / Financing Income. Amount: `interest_amount`.
4. Memo on both: `Loan {application_number} • Installment {payment_number}`.
5. Writes a single linked `qbo_sync_logs` row containing both deposit IDs in `payload`. If either Deposit POST fails, void the one that succeeded (or mark `pending_rollback` and surface in `/qbo-health`) and retry the pair atomically. No half-posted installments.

Cash basis is assumed (interest recognized at payment time). No monthly accrual job.

---

### 6. Stripe payout reconciliation (clearing → operating bank)

Add `stripe-payout-webhook` (or extend `stripe-webhook` for `payout.paid`) that, when a Stripe payout lands in the operating bank:

1. Pulls the payout's balance transactions, groups by `metadata.payment_type`.
2. Creates QBO **Transfers** from each clearing account to the operating bank (Bluevine/Mercury — user-selected) for the grouped totals:
   - Trip total → Transfer from Trip Stripe Clearing → Operating Bank
   - Loan principal total → Transfer from Loan Principal Clearing → Operating Bank
   - Loan interest total → Transfer from Loan Interest Clearing → Operating Bank
3. Logs a `qbo_sync_logs` row with `trigger_type=stripe_payout_transfer` and the Stripe `payout_id` for idempotency.

This keeps each clearing account's running balance equal to the in-flight Stripe receivable, and lets QBO bank reconciliation match the real bank deposits cleanly.

---

### 7. Schema changes

New / altered tables (single migration):

- `qbo_account_mappings (role text PK, qbo_account_id text, qbo_account_name text, updated_at)` with roles: `trip_clearing`, `loan_principal_clearing`, `loan_interest_clearing`, `loan_receivable`, `interest_income`, `operating_bank`.
- `loan_payment_schedules`: add `stripe_payment_intent_id text`, `qbo_principal_deposit_id text`, `qbo_interest_deposit_id text`, `qbo_synced_at` already exists.
- `trip_payments`: no schema change (already has `stripe_payment_intent_id`).
- `qbo_sync_logs`: add `idempotency_key text unique`, `linked_log_id uuid` (for the loan deposit pair) if not present.

RLS: admin-only writes on `qbo_account_mappings`; staff read.

---

### 8. UI changes (minimal)

- **Settings → QBO**: add an "Account Mapping" card with one dropdown per role, populated from `qbo_accounts`. Save writes to `qbo_account_mappings`.
- **/qbo-health**: add a "Loan Repayments" panel showing recent `loan_repayment_posted` syncs, half-posted pairs flagged red with a Retry button.
- **Loan detail page**: surface principal/interest split per posted installment and the two QBO deposit IDs.

No changes to the public site UI.

---

### 9. Guardrails & cleanup

- Add a CI/lint check (or simple grep test) ensuring no edge function in `crestwell-public-site` imports the QBO client or calls `qbo-sync-trigger`.
- Add a comment block at the top of `stripe-webhook` documenting: "This function only mutates CRM rows. QBO pushes happen via DB triggers."
- Update `mem://features/integrations/qbo-config` and `mem://features/integrations/qbo-automation` memories to reflect the CRM-only-writer rule, the Stripe metadata routing keys, the clearing-account pattern, and the cash-basis loan handling.

---

### Out of scope for this plan

- Migrating historical loan payments retroactively (can be a follow-up backfill script using existing `qbo-backfill-payments` pattern).
- Accrual-basis handling (explicitly deferred — cash basis chosen).
- Stripe Connect (explicitly rejected — single account).