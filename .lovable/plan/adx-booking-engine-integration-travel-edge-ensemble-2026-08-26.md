# ADX Booking Engine Integration (Travel Edge / Ensemble)

ADX is TripArc's booking platform, distributed through your Ensemble consortium. You chose **full API search/book** with bookings landing as **booking + margin lines**. ADX does not publish a public API — credentials come through Ensemble/TripArc, which you don't have yet. So this plan builds the complete integration architecture now: everything is coded, tested, and ready to flip on the moment API keys arrive, while a fully working tracking path goes live immediately.

## Phase 1 — Live immediately (no API keys required)

1. **Register ADX as a supplier**
   - Insert "ADX (Travel Edge)" into `suppliers` (via run_sql data insert) so agents can log ADX bookings on any trip today through the existing Add Booking dialog — confirmation number, price, commission — with margin lines flowing through the existing `booking_margin_lines` + `calculate_booking_margin` engine. No code change needed for this path; it already works for every supplier.

2. **Quick-launch into ADX**
   - Add an "Open ADX Dashboard" button on the supplier panel / booking dialog that deep-links to the ADX advisor dashboard in a new tab, so agents move CRM → ADX in one click.

3. **Parse ADX confirmation emails**
   - Extend `supabase/functions/parse-booking-confirmation` with an ADX-aware prompt section so forwarded ADX confirmations (air/hotel) auto-extract supplier, confirmation number, dates, gross/net, and commission — creating the booking and margin lines through the existing Parse Confirmation dialog.

## Phase 2 — Full API search/book (auto-activates when credentials arrive)

4. **`adx` edge function** (`supabase/functions/adx/index.ts`)
   - Modeled 1:1 on `project-expedition`: auth-gated (requires signed-in user), action-based: `search`, `product`, `availability`, `book`, `booking-lookup`.
   - Reads secrets `ADX_API_KEY` + `ADX_BASE_URL` (requested via add_secret when you obtain them). Until configured, it returns a clear "not configured" state and the UI shows Phase 1 tracking mode instead of errors.

5. **`adx_bookings` table** (migration)
   - Mirrors `project_expedition_bookings`: agent, trip/client links, ADX booking ref, product details, travel date, travelers, currency, total/net price, commission, status, raw response. Full GRANTs + RLS (owner agent reads own; admin/bookkeeper read all).

6. **Booking + margin line creation on book**
   - On successful ADX booking: insert the `adx_bookings` row, create the linked `bookings` row (supplier = ADX, confirmation number), insert the margin line, and fire `calculate_booking_margin` — same flow as `AddTripBookingDialog`.

7. **ADX panel UI** (`src/components/suppliers/AdxPanel.tsx`)
   - Search/compare/book interface modeled on `ProjectExpeditionPanel`, surfaced as a third tab ("ADX") on the `/excursions` page next to Viator and Project Expedition (air/hotel focus per ADX's strengths). Shows the Phase 1 tracking UI until API keys are configured.

## What you need to do (outside the app)

- Contact your Ensemble rep (or TripArc) and request **ADX API access for your agency** — ask specifically for an API key and base URL for the advisor booking API. When you have them, hand them over and Phase 2 activates with a secret add + redeploy; no other changes needed.

## Technical details

- **Pattern source**: `supabase/functions/project-expedition/index.ts` (proxy + auth + persistence), `src/components/suppliers/ProjectExpeditionPanel.tsx` (UI), `src/components/trips/AddTripBookingDialog.tsx` (booking + margin line flow), `supabase/functions/parse-booking-confirmation/index.ts` (email parsing).
- **New files**: `supabase/functions/adx/index.ts`, `src/components/suppliers/AdxPanel.tsx`.
- **Modified files**: `src/pages/Excursions.tsx` (new tab), `supabase/functions/parse-booking-confirmation/index.ts` (ADX prompt), `AddTripBookingDialog.tsx` (ADX deep-link when supplier is ADX).
- **Migration**: `adx_bookings` table with GRANTs (`authenticated` full, `service_role` all), RLS enabled, owner/admin policies, `updated_at` trigger.
- **Secrets (when available)**: `ADX_API_KEY`, `ADX_BASE_URL` via add_secret — never in code.
- **Memory**: save an ADX integration note (TripArc/Ensemble, phased approach) to project memory.
