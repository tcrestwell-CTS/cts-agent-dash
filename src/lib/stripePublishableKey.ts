/**
 * Publishable key for Stripe.js on the client.
 *
 * Client/customer payments (and supplier virtual-card issuing) run on the
 * dedicated NEW Stripe account (acct_1RqmDcPN86ZkZBcR). The managed
 * VITE_STRIPE_PUBLISHABLE_KEY build variable still holds the OLD account's
 * key and cannot be updated from code, so the new-account key is pinned here
 * and every Stripe.js call site imports this constant.
 *
 * Loan repayments and agent subscriptions remain on the OLD Stripe account
 * and do not load Stripe.js from this constant.
 */
export const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51RqmDcPN86ZkZBcRku28H4mlTEYLDF5pg6O3pDbhogoPYobO1vyiNTrzrmLDKloxwQYfnWNaBBiOGGlQg7MWAjJZ009MLOSUg0";
