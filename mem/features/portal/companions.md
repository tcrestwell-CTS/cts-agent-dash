---
name: Companions and travelers
description: client_companions, trip_travelers, and booking_travelers all carry an optional linked_client_id FK to clients. The clients table is the canonical contact record. Add flows include a ClientSearchCombobox for searching/linking existing clients or creating new ones; identity fields lock when linked.
type: feature
---
All people in the system (companions, trip travelers, booking travelers) are unified through the `clients` table.

**Schema**: `client_companions`, `trip_travelers`, and `booking_travelers` each have a nullable `linked_client_id uuid REFERENCES clients(id) ON DELETE SET NULL`.

**Component**: `src/components/shared/ClientSearchCombobox.tsx` is the reusable client typeahead. It supports `onSelect`, `onClear`, `onCreateNew`, and `excludeClientIds`. Use it at the top of any add/edit dialog for travelers/companions.

**Add flow**: When the user picks an existing client, store its id as `linked_client_id` and pre-fill identity fields. Identity fields (first/last name, email, phone, birthday, KTN, passport) become read-only when linked. Trip-specific fields (relationship, is_primary, notes) stay editable. Free-form entry without linking is still allowed as a fallback.

**Migration backfill**: Existing companions/travelers were matched to clients by `(user_id, lower(email))` first, then by `(user_id, lower(first_name), lower(last_name))`. Unmatched rows with an email got new client records created (source='companion_migration' or 'traveler_migration') and were linked.

**Wired entry points**:
- `src/components/clients/CompanionDialog.tsx` (CRM companion add)
- `src/components/trips/TripTravelersCard.tsx` (Trip Detail travelers)
- Booking travelers picker (`AddBookingDialog.tsx`) — already operates on companion records, so the linked client is inherited automatically.
- `ClientUpdateForm.tsx` (public token form) — intentionally NOT wired since the public client doesn't have CRM access.
