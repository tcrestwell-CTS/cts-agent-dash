---
name: MSC Cruises API 3.0
description: MSC integration architecture — flat-file cache for search, live POX API for booking only, price arithmetic rules
type: feature
---
MSC API 3.0 is **stateless plain XML over HTTPS** (no SOAP/WSDL, no session, no mTLS). Auth is three headers on every call: `UserId`, `AgencyId`, `Password`. Test base `https://layer7test.msccruises.com/test`; production base must come from MSC (`MSC_BASE_URL`).

**Architecture MSC prescribes (do not deviate):** browse/search runs ONLY off the local Flat File 3.0 cache (`msc_*` tables, refreshed 3-4x daily by `msc-flatfile-sync`). The live API (`msc-cruise` edge function) is select-and-book only — `DtsSearchCruisesV1` is called with a `CruiseID` already held from the cache. Calling it to browse gets throttled by the Layer7 gateway.

- Market file + agency file must be **merged** — the agency file holds only Crestwell's dedicated promotions (`msc_fares.source` = market/agency).
- **Never treat HTTP 200 as success.** Parse `AdvisoryInfo`; `MessageType=F` is a failure.
- **Price arithmetic:** cabin-price columns include NCF but exclude port charges (`GFT-*`) and service charges. Service charges are `PROMO|STANDARD`, per person per night. Always display the computed total via `computeMscTotal` — never the bare `2A` column.
- `CruiseID` = `{ShipCd}{YYYYMMDD}{EmbarkPort}{DisembarkPort}`.
- Field-name trap: `DtsSearchCruisesV1` uses flat abbreviated names (`AgentId`, `MktCd`, `CurrcyCd`); every other message uses long names nested in `<BookingContext>`. `DtsBookRequestMessageV1` children are an enforced `xs:sequence`.
- Secrets: `MSC_USER_ID`, `MSC_AGENCY_ID`, `MSC_PASSWORD`, `MSC_AGENT_ID`, `MSC_ENV`, `MSC_BASE_URL`, `MSC_FLATFILE_USER`, `MSC_FLATFILE_PASSWORD`, `MSC_FLATFILE_AGENCY_CODE`.