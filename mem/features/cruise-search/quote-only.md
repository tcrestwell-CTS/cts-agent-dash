---
name: Cruise search pricing display
description: Cruise search SHOWS prices (decision reversed 2026-09-28); per-cabin fares, price filters/sort and live-offer link are all displayed
type: design
---
Cruise search (CruiseFeed `/cruises` search) **shows prices** — Tim reversed the quote-only decision the same day (2026-09-28):

- Result cards, compare drawer, filters (price slider + price sort), and the details modal (fare panel, per-cabin prices, taxes, OBC, alternate-sailing prices, "View live offer" link) all display pricing again.
- Rationale: price transparency drives leads; visible "from" prices + a quote CTA outperforms quote-only for search traffic.
- "Add to Trip" stays enabled in the details modal as an internal agent booking tool with fare data (lead fare notes, cabin choices).
- The quote-request dialog was removed; a quote path can be re-added later as a CTA alongside visible prices if wanted.
- MSC direct tab (MscCruiseSearch/MscFareDrawer) shows its cached fares — now consistent with the rest of search.
