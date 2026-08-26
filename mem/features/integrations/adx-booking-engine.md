---
name: ADX Booking Engine Integration
description: ADX (Travel Edge / TripArc, via Ensemble) integration — phased approach, adx edge function, adx_bookings table, supplier record
type: feature
---

# ADX Booking Engine Integration

ADX is TripArc's booking platform, accessed through the **Ensemble** consortium. Air, hotel, cruise, and DMC content with transparent commissions.

## Phase state

- **Phase 1 (live):** Supplier record `ADX (Travel Edge)` (type `other`, website `https://adx.traveledge.com`) is always shown in the Add Booking dialog supplier list regardless of booking type; an "Open ADX Dashboard" deep-link appears when it's selected. `parse-supplier-confirmation` recognizes ADX/Travel Edge/Ensemble confirmation emails and splits bundled components.
- **Phase 2 (credential-gated):** `adx` edge function (actions: status, search, product, availability, book, booking-lookup) + `adx_bookings` table + ADX tab on `/excursions`. Blocked on `ADX_API_KEY` / `ADX_BASE_URL` secrets — Tim must request API access from Ensemble / Travel Edge. `action: "status"` returns `{configured}` so the UI shows tracking mode until then.

## Rules

- Never error the UI when ADX keys are missing — show tracking mode instead.
- On `book`: insert `adx_bookings`, then create the CRM `bookings` row (supplier = ADX, `supplier_confirmation_number` = ADX ref), a `booking_margin_lines` row (`source: "api"`), and fire `calculate_booking_margin`. ADX bookings must flow through the margin engine like manual bookings.
- `adx_bookings` RLS: agents manage their own rows; admin/office_admin/bookkeeper read all.
