---
name: Cruise search quote-only pricing
description: Cruise search shows NO prices anywhere — Request Quote creates a quote_requests lead; live pricing returns only in the generated quote
type: design
---
Cruise search (CruiseFeed `/cruises` search) is **quote-only** by Tim's decision (2026-09-28):

- No fares are displayed anywhere: not on result cards, compare drawer, filters (price slider removed, price sort removed), or the details modal (fare panel, per-cabin prices, taxes, alternate-sailing prices, "View live offer" link all removed).
- Every result shows "Pricing available on request" and a **Request Quote** CTA (`RequestQuoteDialog`).
- Request Quote inserts into `quote_requests` (trip_type "cruise", sailing details + holiday_ref in `message`) → flows into the Leads pipeline, where the generated proposal/quote returns **live, cabin-by-cabin pricing** to the client.
- Rationale: hidden prices push users through the quote request, and quotes now carry live CruiseFeed pricing.
- "Add to Trip" stays enabled in the details modal as an internal agent booking tool and still carries fare data (lead fare notes, cabin choices) — internal only.
- MSC direct tab (MscCruiseSearch/MscFareDrawer) still shows cached fares — flagged as inconsistent if Tim wants quote-only there too.
