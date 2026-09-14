# Roadmap

- [x] Verify Elvira Cruz's Checkout Session, subscription, customer, and first invoice directly in Stripe.
- [x] Add restricted, idempotent CTN approval reconciliation records to the CRM backend.
- [x] Harden and deploy `ctn-approve` with strict input validation, payment-state gating, repeat-safe invitations, durable failure records, and subscription mapping.
- [x] Record Elvira's case as payment pending without creating access or sending a paid welcome email.
- [ ] Update CTN-Hosting Payment Link metadata, webhook matching, async-payment events, administrator alerts, and daily retry job. Blocked: CTN-Hosting is not an accessible project/repository in this workspace.
- [ ] Mark Elvira's external application paid and complete onboarding. Blocked: Stripe invoice `in_1UEqRvPJljF0WNcYMeapjRYt` currently shows $0 paid/$29 remaining, and the external `ctn_applications` database is not connected here.

- [ ] Add staff-only Academy material upload and lesson-assignment workflow
- [ ] Process uploaded CTN training files and replace matching lesson drafts
