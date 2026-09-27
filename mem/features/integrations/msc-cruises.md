---
name: MSC Cruises API 3.0
description: MSC integration architecture — Cache REST feed for search (Flat File deprecated), live POX API for booking only, price arithmetic rules
type: feature
---
MSC API 3.0 is **stateless plain XML over HTTPS** (no SOAP/WSDL, no session, no mTLS). Auth is three headers on every call: `UserId`, `AgencyId`, `Password`. Test base `https://layer7test.msccruises.com/test`; production base `https://layer7prod.msccruises.com` (NO path prefix — `/prod`, `/prd`, `/live` all return Layer7 `Policy Falsified`). Stored in `MSC_BASE_URL`, with `MSC_ENV=production`.

**Flat File 3.0 is DEPRECATED (MSC, Aug 2026)** — decommissioned during 2027, not for new implementations. The replacement source for the local cache is **MSC Cache REST**. Do not build new work against Flat File; `msc-flatfile-sync` is legacy and to be replaced by a Cache REST sync job. **Cache REST spec was never received** (as of Sep 27, 2026) — no public docs on the web; the spec lives only in MSC's partner-facing "Cache REST documentation" and must come from Tim before the sync can be built.

**Architecture MSC prescribes (do not deviate):** browse/search runs ONLY off the local cache (`msc_*` tables, refreshed several times daily). The live API (`msc-cruise` edge function) is select-and-book only — `DtsSearchCruisesV1` is called with a `CruiseID` already held from the cache. Calling it to browse gets throttled by the Layer7 gateway.

- Market feed + agency feed must be **merged** — the agency feed holds only Crestwell's dedicated promotions (`msc_fares.source` = market/agency).
- **Never treat HTTP 200 as success.** Parse `AdvisoryInfo`; `MessageType=F` is a failure.
- **Price arithmetic:** cabin-price columns include NCF but exclude port charges (`GFT-*`) and service charges. Service charges are `PROMO|STANDARD`, per person per night. Always display the computed total via `computeMscTotal` — never the bare `2A` column.
- `CruiseID` = `{ShipCd}{YYYYMMDD}{EmbarkPort}{DisembarkPort}`.
- **`DtsSearchCruisesV1` must be called with CruiseID *and* `PromotionCode` = the cached FARE-CD.** Omitting the fare code makes the gateway fan out over every promotion — this is the documented cause of slow/throttled searches. Reduced-payload filters `PriceType`/`Category`/`PriceCode` narrow the response; `ItemPaxApplicability` in the response gives per-person-type item eligibility (`I,J,A,S`).
- **One Step Booking**: a QUOTATION (`BookOrQuote=Q`) can be created in a single `DtsBookRequestMessageV1` built entirely from cache — only for fares flagged `CRUISE-ONLY=Yes` AND `NOW-AVL=Yes` (`msc_fares.cruise_only` / `now_available`). `CabinNo` `G00000` = auto-assign in category. Item `APPLY-PAX='*'` means all passengers (expand to `1,2,...`).
- Field-name trap: `DtsSearchCruisesV1` uses flat abbreviated names (`AgentId`, `MktCd`, `CurrcyCd`); every other message uses long names nested in `<BookingContext>`. `DtsBookRequestMessageV1` children are an enforced `xs:sequence`.
- **Agency Login** (`/mscbee/services/agency/agencylogin`, root `DtsAgencyLoginMessage`) is the credential-validation call and the source of the agency defaults (`OfficeCode`, `MarketCode`, `CurrencyCode`, consortium, `PayMethod`) plus `SecurityOverrides` (Yes/No permissions: booking, cancelling, CC payment, group management) and `ContractDetail`. Advisory codes: `ACY_010` = bad AgencyID/AgentID pair, `ACY_004` = bad password. Confirmed working on the test gateway.
- Secrets: `MSC_USER_ID`, `MSC_AGENCY_ID`, `MSC_PASSWORD`, `MSC_AGENT_ID`, `MSC_ENV`, `MSC_BASE_URL`, `MSC_FLATFILE_USER`, `MSC_FLATFILE_PASSWORD`, `MSC_FLATFILE_AGENCY_CODE`.