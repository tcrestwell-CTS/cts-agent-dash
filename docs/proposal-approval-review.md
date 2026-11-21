# Individual proposal approval review

## Changes
- `src/pages/ProposalView.tsx`: approved-state heading and advisor availability follow-up on the same page; retains proposal text, including when reopening an approved/converted proposal after pricing expiry. Handles all existing approval RPC result codes instead of treating any error-free response as success. Blocks repeat in-flight clicks, resets state when the token changes, and shows retryable errors inline. No payment or traveler links are inferred.
- `src/test/proposal-view.test.tsx`: 18 regression tests for approval, repeat clicks, reopening, rejected/network requests, expired/invalid links and withholding unverified linked-record actions.
- `AGENTS.md`: records the public-response-only boundary for proposal next steps.
- `roadmap.md`: tracks this request.

## Existing workflow traced (source and hosted function definitions)
- `/proposal/:token` calls `get_proposal`, `mark_proposal_viewed`, and `approve_proposal`. The existing public response exposes proposal fields only, not `converted_trip_id`, booking readiness or customer-access tokens. `proposal_options` is not an authorization contract.
- `approve_proposal` locks the quote row, returns `already_approved` for approved/converted records, rejects unavailable/expired records, and updates proposal approval fields only. It does not create clients, trips, bookings, payments or notifications. Existing quote triggers respond to lead/AI stage transitions, not this approval transition. These behaviors were inspected, not modified.
- Quote requests can have a `converted_trip_id`; advisor-controlled conversion is separate. A trip link alone neither proves availability nor grants customer access.
- `/update-info/:token` uses `client-update` to check an unused, unexpired client-update token before returning traveler information.
- `/authorize/:token` uses an existing card-authorization access token; submission requires a pending authorization. Its existing read resolves booking/client information with that separate token.
- `/pay` and `/payment` use `SecurePay`. Secure-token links go through `validate-token` (active, expiry, single-use, type and paid-installment checks). Older advisor-issued payloads follow an existing separate path; `create-payment-intent` re-locks a linked installment amount server-side. Neither path is synthesized from a proposal.
- No existing public proposal field explicitly identifies an authorized, ready traveler-details, card-authorization or direct-deposit action. All approved proposals therefore use the requested advisor-follow-up fallback.

## Verification
- 46 tests passed: proposal review (18), group pricing (15), group payment schedule (5), existing client routes (8).
- Preview harness reported `build OK` after the changes; no manual build was run.
- Browser checked first approval, refresh, leaving/reopening the same link, a failed approval and retry-enabled button, expired/not-found/not-approvable/already-approved responses, an older converted proposal and invalid/expired links using intercepted test RPC responses. One approval request was observed across successful approval, refresh and reopen.
- Desktop and 320px/390px screenshots inspected; approved message and error/button fit without horizontal overflow. No browser runtime errors observed.
- The real existing Obama group booking page loaded its party-size controls and Continue to Package Selection button. No group submission or payment was made.

## Limitations and missing dependency
- Browser proposal fixtures intercepted RPC requests; no production proposal was approved or altered, and hosted approval/notification behavior was verified in source only. No card, payment intent, email or financial record was created.
- Specific next-action buttons are deliberately not implemented: they require an explicit server-verified readiness/access contract associating a proposal with the correct customer flow. Adding one would require a broader public-response or workflow change outside this brief.
- All changes remain in preview. Nothing was published and no functions or migrations were deployed.