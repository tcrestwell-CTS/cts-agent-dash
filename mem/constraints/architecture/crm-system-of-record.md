---
name: CRM as System of Record (QBO downstream-only)
description: Architectural rule — CRM is sole writer to QuickBooks; Stripe routes by metadata; cash-basis loan accounting; clearing accounts pattern
type: constraint
---

# CRM as System of Record — QBO downstream-only

**Rule:** The CRM (Lovable) is the single source of truth for all customers, vendors, trips, payments, and payment plans. QuickBooks Online receives transactions pushed from the CRM only — never the reverse, never directly from Stripe webhooks, never from `crestwellgetaways.com`.

## Stripe routing by metadata

Every Stripe Checkout / Subscription / PaymentIntent created by the CRM stamps:

```
payment_type:    "trip_installment" | "loan_repayment"
trip_payment_id: <uuid>   (when trip_installment)
trip_id:         <uuid>   (when trip_installment)
loan_id:         <uuid>   (when loan_repayment)
installment_no:  <int>    (optional; auto-resolved for autopay subscriptions)
```

`stripe-webhook` reads `payment_type` and updates the matching `trip_payments` or `loan_payment_schedules` row to `paid`. For subscription invoices (loan autopay), if PI metadata is empty, it falls back to `subscription.metadata`. The webhook never calls QBO directly.

## DB triggers (CRM → QBO via `qbo-sync-trigger`)

| Event | Handler | QBO action |
|---|---|---|
| `clients` INSERT | `client_created` | Create QBO Customer (idempotent via `qbo_client_mappings`) |
| `suppliers` INSERT | `supplier_created` | Create QBO Vendor (idempotent via `qbo_supplier_mappings`) |
| `trip_payments` → paid | `client_payment_received` | Sales Receipt + Bank Deposit |
| `loan_payment_schedules` → paid | `loan_repayment_posted` | **Linked pair** of Bank Deposits (cash basis) |
| `bookings.supplier_paid_status` → paid | `supplier_paid` | Expense (NOT Bills — Crestwell does not use Bills) |
| `trips` → completed | `trip_completed` | Commission Journal Entry |
| `commissions` → paid | `commission_received` | Commission Deposit |
| `agent_payouts.override_approved` | `payout_approved` | Agent Payout Bill |

## Loan repayment (cash basis, atomic pair)

When `loan_payment_schedules.status` flips to `paid`, two QBO Bank Deposits are posted:

- **Principal Deposit** — Deposit Account: Loan Principal Clearing. Source line credits Loan Receivable.
- **Interest Deposit** — Deposit Account: Loan Interest Clearing. Source line credits Interest / Financing Income.

Idempotency key: `loan_repayment:{schedule_id}` on `qbo_sync_logs`. Per-deposit IDs are persisted on `loan_payment_schedules` (`qbo_principal_deposit_id`, `qbo_interest_deposit_id`) so retries don't double-post. Failed pairs are logged with status `pending_rollback` for manual /qbo-health intervention.

## Clearing accounts pattern (Stripe → real bank)

Three QBO Other Current Asset clearing accounts: Trip Stripe Clearing, Loan Principal Clearing, Loan Interest Clearing. Stripe payout lands in the physical operating bank → the CRM creates QBO Transfers from each clearing account to the operating bank for the relevant portion. Vendor expenses always draw from the operating bank, never from clearing.

## Account mapping

Roles mapped in `qbo_account_mappings` (admin UI: Settings → Integrations → QuickBooks Account Mapping): `trip_clearing`, `loan_principal_clearing`, `loan_interest_clearing`, `loan_receivable`, `interest_income`, `operating_bank`. Trigger handlers look up account IDs by role at push time.

## Forbidden

- No Stripe→QBO direct path.
- No QBO writes from `crestwell-public-site`.
- No accrual-basis loan handling (cash basis only — interest recognized at payment).
- No Stripe Connect.
- No QBO Bills (use Expenses).
