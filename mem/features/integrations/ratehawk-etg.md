---
name: RateHawk / ETG Hotel Supplier
description: RateHawk (Emerging Travel Group) as second agent-selectable hotel supplier beside Hotelbeds — ratehawk functions, tables, caching rules, cert test hotels, secrets
type: feature
---

# RateHawk / ETG Hotel Supplier

## Architecture
- Dual supplier: Hotelbeds AND RateHawk. Agent picks one on the search page. Results are NOT merged; neither replaces the other.
- Separate stack: `ratehawk` function (search_by_region, search_by_hotel_ids, search_by_geo, get_cached_hotels), `ratehawk-content-sync` function, tables `ratehawk_hotels`, `ratehawk_search_cache`, `ratehawk_sync_runs`, `ratehawk_api_usage`, RPC `ratehawk_increment_search_usage`. Never touch `hotelbeds*` code/tables when working on RateHawk.
- Auth: HTTP Basic base64(`RATEHAWK_KEY_ID:RATEHAWK_KEY`). Base URL by `RATEHAWK_ENV`: sandbox `https://api-sandbox.ratehawk.com` (default), production `https://api.ratehawk.com`.
- SERP shows only the LOWEST rate per hotel; specific rates are validated via hotelpage/prebook (later phase).

## Caching rules (ETG certification)
- SERP cache TTL is short: `RATEHAWK_SEARCH_CACHE_TTL_SECONDS` default 300 (not Hotelbeds' 1800).
- hotelpage and prebook responses must NEVER be cached. Do not copy Hotelbeds' caching code into those actions.

## Certification test hotels
- Sandbox: `10004834`, `8819557` (default ids for content sync).
- `8473727` — "test" env demo only.

## Secrets
`RATEHAWK_KEY_ID`, `RATEHAWK_KEY`, `RATEHAWK_ENV` (sandbox), `RATEHAWK_SEARCH_CACHE_TTL_SECONDS` (300), `RATEHAWK_DAILY_SEARCH_CAP` (45), `RATEHAWK_SEARCH_RATE_LIMIT_PER_MIN` (6). Keys pending from Tim.

## Limitations
- Region-based hotel-ID discovery (`/api/content/v1/filter_values`, `/api/content/v1/hotel_ids_by_filter`) is deferred — query params undocumented in the OpenAPI spec; confirm with ETG account manager. Content sync is driven by an explicit `ids` list for now.
- The Hotel Search page's RateHawk tab is scoped to the certification test hotels via `search_by_hotel_ids` (no destination/region search UI) because of the region_id mapping gap; it is read-only — no booking, rate-check, or voucher flow.
