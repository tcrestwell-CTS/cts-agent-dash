---
name: Agency other income (advisor subscriptions + loan interest)
description: Advisor subscription fees and loan interest count as agency income; table, surfaces, and QBO posting
type: feature
---

Agency income = trip commission/margin **plus** "other income":

1. **Advisor subscription payments** — `agent_subscription_payments` table (advisor, plan, amount, payment_date, period, method, Stripe PI, qbo_deposit_id). Managed by admin/office_admin/bookkeeper; advisors can read their own rows.
2. **Loan payments** — derived from paid `loan_payment_schedules`. Only the **interest** portion is income (cash basis); principal repays the loan receivable and is shown separately, never in income totals.

Hook: `useAgencyOtherIncome({ start, end })` (end is exclusive) returns rows + `subscriptionTotal`, `loanInterestTotal`, `loanPrincipalTotal`, `total`.

Surfaces: dashboard "Agency income" KPI adds other income (plus its own "Other income" tile), Analytics → Agency Sales "Other Agency Income" card, Back Office → Transactions → **Other Income** (`/bookkeeper/other-income`) with logging dialog + CSV, and `/bookkeeper/income` includes other-income rows in its total.

QBO: `agent_subscription_payments` marked paid fires `trigger_qbo_agent_subscription_received` → `qbo-sync-trigger` case `agent_subscription_received`, posting a Deposit into the mapped `operating_bank` crediting an auto-provisioned "Advisor Subscription Income" account. Idempotency key `agent_subscription:{id}`. Loan repayments already sync via `loan_repayment_posted`.
