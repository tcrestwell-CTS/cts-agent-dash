---
name: Advisor billing & subscription (Settings → Billing)
description: agent_subscriptions table, agent-billing edge function for card updates, payout info in the same tab
type: feature
---

Each advisor's Settings → **Billing** tab shows the plan they actually signed up for, their card on file, recent subscription charges, and their payout details (payout form embedded via `AgentPayoutSettings`).

- `agent_subscriptions` (one row per advisor, unique `agent_user_id`): plan_name, plan_description, amount, billing_interval, status, started_on, next_billing_date, stripe_customer_id, stripe_subscription_id, payment_method_brand/last4/exp. Advisors read their own row; admin/office_admin manage all; bookkeeper reads.
- Admins set plans in Back Office → Transactions → Other Income → **Advisor plans** (`AdvisorPlansPanel`).
- `agent-billing` edge function (`update_payment_method` | `sync_payment_method`): validates the caller's JWT, ensures a Stripe customer for the advisor's email, returns a Stripe Billing Portal URL (falls back to a Checkout `mode=setup` session if the portal isn't configured), and syncs card brand/last4/exp plus live Stripe subscription amount/interval/period end back to `agent_subscriptions`. No card data is ever stored in the app.
- Actual subscription *charges* remain in `agent_subscription_payments` (agency other income + QBO deposit).
