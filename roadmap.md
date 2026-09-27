# Roadmap

- [ ] Build MSC Cache REST sync (replace deprecated `msc-flatfile-sync`), run first load, schedule ~8x/day — **blocked: awaiting MSC's Cache REST documentation from Tim** (partner-portal doc; never provided; no public spec on the web as of 2026-09-27).

## Guided trip flow (approved 2026-09-27)
- [x] 1. Publish gate blocks (required vs recommended, admin override w/ reason, server trigger)
- [x] 2. Clone trip copies itinerary days/items
- [x] 3. Step-by-step Trip Builder (alongside New Trip)
- [x] 4. Per-item AI actions in itinerary builder
- [x] 5. Autosave itinerary edits + remove full refetch per edit
- [x] 6. Unified copy engine (sub-trips + templates), tested on real group-trip copies before switch
