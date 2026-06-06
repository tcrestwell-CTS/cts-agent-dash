## TxtYa Travels Integration

TxtYa exposes a single inbound endpoint that **upserts a Trip + Traveler in one call**, which maps perfectly to our group/sub-trip model:

- Parent group trip → TxtYa **Trip** (keyed by `bookingRef`)
- Each sub-trip's client (and companion) → TxtYa **Traveler** (auto-joins the Trip's "All Travelers" group → enables SMS/email blasts)

New travelers are automatically added to the trip's group on TxtYa's side, so we just need to fire one POST per signup.

---

### What gets built

**1. Secret + config**
- Store `TXTYA_API_KEY` (bearer token from TxtYa Settings → Integrations) via the secrets tool.
- Add a per-agency toggle `txtya_sync_enabled` on `branding_settings` (or `profiles`) so each agency can opt-in.

**2. Edge function: `txtya-sync`**
- Inputs: `{ trip_id, traveler_client_id?, include_companion? }`.
- Loads parent group trip (resolves `parent_trip_id` if a sub-trip is passed) → builds `trip` payload using `trip.id` as `bookingRef`.
- Loads client (and optionally companion from `client_companions`) → builds `traveler` payload.
- POSTs to `https://travels.txtya.com/api/integrations/bookings` with `Authorization: Bearer ${TXTYA_API_KEY}`.
- Stores `txtya_trip_id` / `txtya_traveler_id` from response on `trips` / `clients` for idempotency + future updates.
- Logs every call to a new `txtya_sync_log` table (request, response, status) for debugging.

**3. Automatic triggers**
- **Public group signup** (`supabase/functions/group-signup/index.ts`): after the sub-trip + companion are inserted, invoke `txtya-sync` for the new client (and companion if 2 travelers). Non-blocking — log errors but never fail the signup.
- **Manual sub-trip creation** (`AddTripDialog` when a sub-trip is created under a group parent): after insert, invoke `txtya-sync` from the client.
- **Group trip created** (parent): first sub-trip sync auto-creates the Trip on TxtYa, so no extra call needed. (Optional: a "Sync to TxtYa now" button on the group trip page.)

**4. UI**
- On the group trip detail page, add a small "TxtYa" status card showing:
  - Sync enabled/disabled
  - Linked TxtYa Trip ID (if any)
  - "Resync all travelers" button (loops sub-trips → invokes edge function)
  - Last sync timestamp + error count (from `txtya_sync_log`)

**5. Database migration**
```sql
ALTER TABLE trips    ADD COLUMN txtya_trip_id     text;
ALTER TABLE clients  ADD COLUMN txtya_traveler_id text;

CREATE TABLE public.txtya_sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  trip_id uuid,
  client_id uuid,
  direction text not null default 'outbound',
  status int,
  request_body jsonb,
  response_body jsonb,
  error text,
  created_at timestamptz not null default now()
);
-- + GRANTs (authenticated select own rows; service_role all) + RLS policies.
```

---

### Payload mapping

| TxtYa field           | Source                                         |
|-----------------------|------------------------------------------------|
| `trip.bookingRef`     | parent `trips.id`                              |
| `trip.name`           | parent `trips.trip_name`                       |
| `trip.destination`    | `trips.destination`                            |
| `trip.departureDate`  | `trips.depart_date`                            |
| `trip.returnDate`     | `trips.return_date`                            |
| `trip.maxTravelers`   | sum of cabin capacities (if available)         |
| `traveler.displayName`| `clients.name`                                 |
| `traveler.firstName`  | `clients.first_name`                           |
| `traveler.lastName`   | `clients.last_name`                            |
| `traveler.email`      | `clients.email`                                |
| `traveler.phoneNumber`| `clients.phone` (E.164 normalized)             |
| `traveler.preferredChannel` | `'sms'` if phone, else `'email'`         |
| `traveler.bookingRef` | sub-trip `trips.id`                            |
| `traveler.notes`      | cabin category + traveler count                |

---

### Out of scope (can be follow-ups)
- Outbound webhook receiver (TxtYa → CRM) to push `message.sent`, `traveler.updated` back into the CRM activity feed.
- Auto-removal of travelers when a sub-trip is cancelled/archived.
- Per-trip override of the agency-level toggle.

---

### Questions before I build

1. **API key**: do you already have a `btk_…` token from TxtYa Settings → Integrations, or do you need to mint one first?
2. **Companion travelers**: should the 2nd traveler on a sub-trip (the `client_companions` row) also be pushed to TxtYa, or just the primary client?
3. **Scope**: enable for all agencies in your CRM, or gate behind the per-agency toggle (default off)?
