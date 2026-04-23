

# Cruise Search — Polished Results Portal Redesign

Recreate `/cruises` to look and feel like a professional cruise booking portal (Oasis Travel Network reference), powered by the existing **Widgety** integration. We'll keep the current step-based wizard logic available under the hood for cabin pricing/itinerary deep-dives, but the primary UX becomes a **filters-left + results-right** page with rich cruise cards, sorting, comparison, and a polished loading state.

---

## Visual & Brand Direction

- White canvas, navy primary (`#0B2340`-ish via existing tokens), subtle gold accents already in the theme, sky-blue/teal interactive accents.
- Card-based results with cover image, rounded corners, subtle shadow, hover lift.
- Light gray filter rail on the left (sticky on desktop, drawer on mobile).
- Clean typography (existing Inter/Playfair tokens — no new fonts).

All colors will use existing semantic tokens (`bg-card`, `text-primary`, `border`) rather than hardcoded hex, with a small additional set of cruise-portal accents added to `index.css` if needed.

---

## Page Structure

```text
┌──────────────────────────────────────────────────────────────┐
│  Header (logo • nav • phone/contact)            [DashLayout] │
├──────────────────────────────────────────────────────────────┤
│  Search Bar  [Destination][Line][Ship][Month][Nights][Pax]  │
│              [ Search ] [ Reset ]                            │
├──────────────┬───────────────────────────────────────────────┤
│              │  Sort: Recommended ▼   123 cruises found      │
│  Filters     ├───────────────────────────────────────────────┤
│  ──────      │  ┌───────────────────────────────────────┐   │
│  Destination │  │ [img] Title • Line • Ship             │   │
│  Port        │  │ Dates • Nights • Ports                │   │
│  Cruise Line │  │ From $X pp   ☐ Compare  [View][Select]│   │
│  Ship        │  └───────────────────────────────────────┘   │
│  Month       │  ...more cards...                             │
│  Duration    │                                               │
│  Price       │  [ Compare bar pinned bottom when ≥1 ticked ]│
│  Promotions  │                                               │
│  Type tags   │                                               │
│              │                                               │
│  [Reset]     │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

---

## Components (new)

Created under `src/components/cruise-search/`:

1. **`CruiseSearchHeader.tsx`** — agency name/logo, contact phone, simple nav (in-app, sits inside `DashboardLayout`).
2. **`SearchBar.tsx`** — top horizontal search row: Destination, Cruise Line, Ship (cascades from line), Departure Month/Year, Duration range, Travelers. Search + Reset buttons.
3. **`FilterSidebar.tsx`** — all filters (see below). Collapsible groups, "Reset filters" button. Renders inline on desktop and inside a `Sheet` drawer on mobile (trigger via "Filters" button).
4. **`CruiseCard.tsx`** — image, title, line, ship, depart date, nights, ports preview, "from $" price, taxes/fees note, Compare checkbox, View Details + Select buttons. Expand chevron reveals an inline day-by-day mini itinerary.
5. **`CruiseResults.tsx`** — sort dropdown, results count, list of `CruiseCard`s, empty state, paginate/load-more.
6. **`CruiseDetailsModal.tsx`** — Dialog showing full itinerary days, ship details, available sailing dates, cabin pricing tiers. Wraps the existing `holiday`/`itinerary`/`pricing` Widgety calls. Includes "Add to Trip" via existing `AddToTripSelector`.
7. **`CompareDrawer.tsx`** — fixed-bottom bar showing up to 4 selected cruises with an "Compare (n)" button that opens a side-by-side modal.
8. **`CruiseLoadingState.tsx`** — full-bleed overlay with spinner + the exact reference copy:
   - "Please wait while we are searching the best cruise options for you"
   - "Please wait. Do not close this window."
   Plus a row of skeleton cards behind the overlay so the layout doesn't pop.
9. **`CruiseCardSkeleton.tsx`** — shimmer placeholder for individual cards.

---

## Filters (client-side over the current Widgety result set)

| Filter | Source |
|---|---|
| Destination (region) | `AVAILABLE_DESTINATIONS` constant + Widgety `regions` param on search |
| Departure port | Derived from results' `starts_at` / locations + Widgety `locations` param |
| Cruise line | `AVAILABLE_OPERATORS` + Widgety `operators` param |
| Ship | Cascades from cruise line via existing `action: "ships"` call |
| Departure month/year | Derived from `date_from` (existing Year+Month selectors) |
| Duration | Slider 1–30+ nights, filters by `nights` |
| Price range | Slider over `priceCache` from `widgety-price-sync` |
| Promotions | Checkboxes for "Onboard credit", "Reduced deposit" — derived from `pricing[].name` keywords |
| Ocean / River | Derived from operator slug (rivers: ama, avalon, uniworld, tauck, celebrity-river) |
| Family / Luxury / Adults-only | Curated tags mapped from operator slug (e.g., Disney/Carnival = family; Seabourn/Silversea/Ritz = luxury; Virgin = adults) |

Server-side params used when triggering a new search: `operators`, `regions`, `locations`, `date_from`, `date_to`. All other filters apply client-side to the returned set for instant feedback.

---

## Sorting

Implemented client-side over the loaded sailings:

- **Recommended** (default) — has-price first, then earliest depart date.
- **Price low to high** — uses `priceCache[holiday_ref]`.
- **Departure date** — earliest first.
- **Duration** — shortest first.

---

## Compare Functionality

- Each card has a Compare checkbox (max 4 selected — show toast if exceeded).
- Selected refs stored in component state.
- `CompareDrawer` pinned to bottom shows thumbnails + "Compare" button.
- Comparison modal renders a horizontal table: image, line, ship, depart, nights, ports, lowest cabin price.

---

## View Details Modal

`CruiseDetailsModal` reuses existing wizard logic but in a single dialog with tabs:
- **Overview** — image, description, ports preview.
- **Sailing Dates** — list from `action: "holiday"` (existing `WidgetyDate[]`).
- **Itinerary** — day-by-day from `action: "itinerary"` for the selected date.
- **Pricing** — cabin tiers from `selectedDate.pricing` (existing `WidgetyPricingDeal[]`).
- **Add to Trip** — existing `AddToTripSelector`.

---

## Loading & Empty States

- **Initial / on Search**: full overlay (`CruiseLoadingState`) covering the results column; sidebar stays interactive but disabled visually.
- **Filter changes (client-side)**: no spinner — instant.
- **Empty result**: illustration + "No cruises match your filters" + Reset CTA.
- **Card skeletons**: shown on first paint while results load.

---

## Mobile Behavior

- < `md`: Search bar stacks vertically (current behavior).
- Filter sidebar replaced by a "Filters" button that opens a right-side `Sheet` (already in shadcn).
- Cards stack full-width.
- Compare bar collapses to a floating button.

---

## Files

**New:**
- `src/components/cruise-search/CruiseSearchHeader.tsx`
- `src/components/cruise-search/SearchBar.tsx`
- `src/components/cruise-search/FilterSidebar.tsx`
- `src/components/cruise-search/CruiseCard.tsx`
- `src/components/cruise-search/CruiseCardSkeleton.tsx`
- `src/components/cruise-search/CruiseResults.tsx`
- `src/components/cruise-search/CruiseDetailsModal.tsx`
- `src/components/cruise-search/CompareDrawer.tsx`
- `src/components/cruise-search/CruiseLoadingState.tsx`
- `src/components/cruise-search/types.ts` — shared Widgety type defs (extracted from current `CruiseSearch.tsx`)
- `src/components/cruise-search/utils.ts` — shared formatters (date, price, port join, tag derivation)

**Edited:**
- `src/pages/CruiseSearch.tsx` — rewritten as a thin orchestration page. Keeps all existing Widgety calls (`search`, `holiday`, `itinerary`, `ships`, `widgety-cruise-prices`, `widgety-price-sync`) and state, but renders the new component layout. The legacy step-based wizard is removed in favor of the modal-driven flow.

**No backend changes** — all data continues to flow through the existing `widgety-cruise`, `widgety-cruise-prices`, and `widgety-price-sync` edge functions. No DB migration, no new secrets.

---

## Out of Scope (stays as-is)

- Widgety edge functions and pricing sync logic.
- `WidgetyCruiseImportDialog` (separate trip-level import flow).
- Auth/routing — `/cruises` route already exists.
- Old wizard behavior — fully replaced; pricing & itinerary now live inside the details modal.

