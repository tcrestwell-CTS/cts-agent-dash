## Goal
In the client portal, let the client check/uncheck **optional line items** inside a booking, see the running total update, then **approve their selection** to lock it in and unlock **Pay Deposit** for the selected amount.

This piggybacks on what already exists:
- `booking_margin_lines.is_optional` (agents already flag lines as optional in `MarginLinesEditor`)
- `portal-data` already returns `is_optional` per pricing line
- Existing Pay Now / deposit / agreement flow on `PortalTripDetail`

## UX flow (Portal → Trip → Bookings card)

Per booking, optional lines render with a checkbox; required lines stay as-is.

```text
Booking: Royal Caribbean Cruise               [Pending your selection]
─────────────────────────────────────────────
  Package                          $4,200    (required)
  Optional add-ons — pick what you want:
  [x] Beverage Package             $  480
  [ ] Specialty Dining 3-night     $  220
  [x] Shore excursion: Cozumel     $  165
─────────────────────────────────────────────
  Your selected total: $4,845
  Deposit due now:     $  500

  [ Approve Selection ]   ← primary
```

After **Approve Selection**:
- Selection is locked (checkboxes disabled, "Locked in on Jun 1, 2026" badge).
- A "Pay Deposit" button appears for that booking using the existing payment-agreement → Stripe/Affirm flow already on this page.
- Agent gets a notification with the chosen lines.
- Client can request changes via the existing "Request Changes" dialog to reopen.

Booking total/badge in the existing "Bookings" card updates to reflect selected total.

## Technical plan

### 1. Database
New migration adding a per-line client selection table (re-uses the `client_option_selections` pattern):

```sql
CREATE TABLE public.client_line_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  margin_line_id uuid NOT NULL REFERENCES public.booking_margin_lines(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  selected boolean NOT NULL DEFAULT true,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, margin_line_id)
);
```

Plus `GRANT`s (authenticated + service_role; no anon — portal writes go through edge function with service role), RLS that mirrors `client_option_selections` (agent who owns the trip + admins can read/write; portal edge function uses service role).

Also a small lock flag on `bookings`:
```sql
ALTER TABLE public.bookings
  ADD COLUMN client_selection_locked_at timestamptz;
```
When non-null, the portal treats the booking as approved/locked.

No changes to `booking_margin_lines` schema — `is_optional` already exists.

### 2. Edge function: `supabase/functions/portal-data/index.ts`
Add three resources (auth via existing `x-portal-token` portal session, validated like other portal routes):

- `GET ?resource=line-selections&tripId=…` → return rows from `client_line_selections` for the trip.
- `POST ?resource=save-line-selections` body `{ bookingId, selections: [{ marginLineId, selected }] }` → upsert; reject if `bookings.client_selection_locked_at` is set.
- `POST ?resource=approve-line-selections` body `{ bookingId }` → set `client_line_selections.locked_at = now()` for all rows of that booking, set `bookings.client_selection_locked_at = now()`, and insert an `agent_notifications` row of type `client_selection_approved` for the booking's owning agent (message lists which optional lines were chosen and the new selected total).

Existing pricing-lines block already returns `is_optional`; extend it to also include `deposit_amount` per line (already in select) so the portal can compute deposit due for the chosen set.

### 3. Hooks: `src/hooks/usePortalData.ts`
Add:
- `usePortalLineSelections(tripId)` — fetches saved selections.
- `useSaveLineSelections()` — mutation, invalidates trip detail + selections.
- `useApproveLineSelections()` — mutation, invalidates trip detail.

### 4. UI: `src/pages/client/PortalTripDetail.tsx` (Bookings card only)
Refactor the inline bookings list (lines ~693-758) into a small `BookingOptionsCard` component in `src/components/client/` that:
- Splits `bookingLines` into required vs optional.
- Renders optional ones with `Checkbox` (semantic tokens, no raw colors).
- Maintains local `Record<lineId, boolean>` initialised from `usePortalLineSelections`; debounced auto-save via `useSaveLineSelections`.
- Shows live "Selected total" and "Deposit due now" (sum of `deposit_amount` for required + checked optional lines, falling back to a trip-level deposit policy if zero).
- If `client_selection_locked_at` is set: disable checkboxes, show "Locked" badge with timestamp, and render a "Pay Deposit" button that calls the existing `handlePayNowClick({ id, amount: depositDue, payment_type: 'deposit', trip_name, … })` flow already on this page.
- If not locked: show "Approve Selection" button that calls `useApproveLineSelections` then surfaces the Pay Deposit button.
- Bookings with **no** optional lines render exactly as today (no behaviour change).

Deposit gating in the existing "Payments" card stays unchanged; the new Pay Deposit button is an additional in-line shortcut targeting the same existing payment edge function.

### 5. Agent-side surfacing (small)
- `useAgentNotifications` already renders `agent_notifications` rows; the new `client_selection_approved` type just shows up with its message — no extra UI change needed.
- Optional polish (skipping unless asked): a "Client locked selection" badge on the booking row inside the agent's `BookingDetail` page.

## Out of scope
- No changes to `booking_margin_lines` schema or `calculate_booking_margin` RPC. The client's selection is a portal-level preference; it doesn't rewrite the booking's authoritative margin lines. The agent decides whether to remove unchosen optional lines from the booking afterwards.
- No new payment method, no Stripe/Affirm changes — re-uses the existing deposit Pay Now flow.
- Itinerary option blocks (`client_option_selections`) are untouched.

## Files

**New**
- `supabase/migrations/<ts>_client_line_selections.sql`
- `src/components/client/BookingOptionsCard.tsx`

**Edited**
- `supabase/functions/portal-data/index.ts` (3 new resources)
- `src/hooks/usePortalData.ts` (3 new hooks)
- `src/pages/client/PortalTripDetail.tsx` (replace inline bookings list with `BookingOptionsCard`)