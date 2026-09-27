---
name: CruiseFeed search
description: CruiseFeed API replaced Widgety for cruise search (triton-cruise-search + /cruises page); Bearer auth, per-result billing, numeric HID notes for RateHawk not applicable here
type: feature
---
# CruiseFeed replaces Widgety

- Widgety is retired: `widgety-cruise` and `widgety-price-sync` are no longer called by search paths (a legacy `WidgetyCruiseImportDialog` import path remains).
- `CRUISEFEED_API_KEY` secret; base `https://api.cruisefeed.io/v1`; auth header `Authorization: Bearer <key>`.
- **Billing: charged per RESULT returned.** Trial grant was 300 lifetime results. Keep per-query limits tight (triton: 8/line; `cruisefeed-cruise`: 6/line) and cache aggressively.
- `cruisefeed-cruise` edge function serves the `/cruises` dashboard page: actions `search` | `ships` | `lines`, requires a Supabase user JWT, caches to `cruisefeed_search_cache` (24h search / 7d ships, service_role only, no public policies).
- `/v1/ships` valid params: `flag_state, limit, offset, operator, q` — filter by `operator` (line name), NOT `cruise_line` (400 unknown_query_parameter).
- `/v1/cruises` params used: `limit, dedupe=true, currency, sort=price, departure_from/to, min_nights, max_nights, cruise_line, region`.
- Response `items[]` fields: `sailing_id`, `cruise_line`, `ship_name`, `departure_date`, `nights`, `embark_port`, `disembark_port`, `itinerary[]` (`is_sea_day`, `port`), `price_amount`, `price_currency`, `booking_url`. Prices and booking links are REAL (unlike Widgety's nulls).
- CTS line universe (10 lines, names match CruiseFeed exactly): Royal Caribbean, Carnival Cruise Line, Norwegian Cruise Line, Disney Cruise Line, MSC Cruises, Princess Cruises, Celebrity Cruises, Holland America Line, Virgin Voyages (adult-only), Explora Journeys (adult-only).
- `triton-cruise-search` still uses `AGENT_SECRET` via `x-agent-secret` header check (not `CW_AGENT_SECRET`).
