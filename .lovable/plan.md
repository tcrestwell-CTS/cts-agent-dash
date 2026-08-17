# Agent Payment Processing Guide

## Goal
Make the recommended agent payment workflow obvious, documented, and discoverable so advisors stop using ad-hoc or error-prone paths.

## Current state
The dashboard already supports several payment paths, but they are scattered and not surfaced as a recommended workflow:
- Client self-service portal payments (Stripe / Affirm) after itinerary approval.
- Agent-initiated "Take Payment" via Stripe Checkout inside the trip detail.
- "Send Payment Link" deep links to `crestwellgetaways.com/pay`.
- Manual logging for cash/check/wire/Zelle.
- Scheduled installments.
- Virtual cards (Stripe Issuing / Affirm VCN) for supplier payments, not client payments.

Recent fixes added a 3-step client approval stepper and payment-agreement gating, but agents still need to know when to use each path.

## Proposed plan

1. **Add a "Payment Options" quick-help panel to the trip detail Payments tab**
   - Surface the 4 recommended paths with one-sentence guidance and the primary CTA.
   - Show which path is appropriate for which scenario (client on phone, async email, cash/check, financing).
   - Keep the existing Add Payment dialog but make the recommended choice obvious.

2. **Document the agent SOP in project memory**
   - Write `mem/features/financial/agent-payment-sop.md` with the decision tree and steps for each path.
   - Include the net-of-fee bookkeeping rule and the QBO reconciliation impact.

3. **Improve the Add Payment dialog default experience**
   - Pre-select the most common mode based on the payment context (e.g., "Take Payment" if a payment is due today, "Send Payment Link" if due later).
   - Add short inline descriptions so the advisor understands each mode before selecting it.
   - Confirm the generated payment link shows the expected amount and trip name before copying.

4. **(Optional) Add a payment-method preference note on the client record**
   - Let advisors note whether a client prefers portal self-pay, phone pay, or manual methods.
   - Display the note in the Add Payment dialog so the team follows the client's preference.

## Out of scope
- Changing Stripe webhook or reconciliation logic (already working).
- Adding new payment providers.
- Modifying the client portal approval flow (already implemented).

## Success criteria
- An advisor can open a trip and understand the recommended payment path within 10 seconds.
- The project memory contains a durable SOP the team can reference and share.
- No regression in existing payment reconciliation or QBO sync behavior.
