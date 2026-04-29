
## Goal

Bring four Tern release-note features into the agent dashboard:

1. Itemized package pricing (internal vs visible vs optional → one rolled-up price)
2. Package line items on invoices
3. AI chat: create group trips and manage tasks
4. Quality-of-life bundle (Branding auto-save, `{{last_name}}` email var, resend pending invites, Project Expedition transfer notes)

---

## 1. Itemized package pricing

Add a per-line "internal only" flag and surface options/add-ons separately from internal cost lines, then roll everything into a single client-facing package price.

**DB migration** (`booking_margin_lines`):
- Add `is_internal BOOLEAN NOT NULL DEFAULT false` — line counts toward total but is hidden from the client.
- (`is_optional` and `is_pass_through` already exist.)

**MarginLinesEditor (`src/components/bookings/MarginLinesEditor.tsx`)**:
- Add an "Internal only (hide from client)" checkbox on each line and on the add-line form.
- Show a small "Hidden" badge on internal lines and an "Optional" badge on optional ones.
- Insert/update payloads include `is_internal`.

**Client-facing roll-up** (used by `SharedTripPricing.tsx`, `PortalTripDetail.tsx`, `portal-data` and `shared-trip` edge functions):
- Internal lines: NOT rendered in the breakdown, but their `total_sell` is added into a "Package base price" row at the top of the booking group, and into the grand total. Matches Tern: client sees one package price, internal items hidden.
- Visible non-optional, non-addon lines: render as today.
- Optional lines (`is_optional = true`): render with the existing toggle so travelers can opt in/out; default ON; toggle updates the rolled-up total.
- Add-ons (`is_pass_through` or `line_type = 'addon'`): keep current toggle behavior.

**Edge functions**:
- `supabase/functions/shared-trip/index.ts` and `supabase/functions/portal-data/index.ts`: include `is_internal` in the `booking_margin_lines` select; in the response, collapse internal lines into a single synthetic "Package" line per booking (sum of `total_sell`) so the client never sees individual hidden items but the total stays correct.

**No financial behavior change**: `calculate_booking_margin` already sums all lines, so internal lines remain in `agency_gross_margin`, commissions, and reports.

---

## 2. Package line items on invoices

Goal: invoices list every visible package line so the client sees the package name, total, and what's included.

**Files**:
- `src/lib/invoiceGenerator.ts`: when generating the invoice for a trip, fetch `booking_margin_lines` for each booking on that trip, filter out `is_internal` lines, and persist them as invoice line items. Show the booking name as a section header and each visible line as a row (description + amount). Optional/add-on lines render with an "Optional" tag.
- `supabase/functions/generate-tern-invoices/index.ts`: same change so Tern-imported invoices include the line breakdown.
- `src/pages/client/PortalInvoiceDetail.tsx`: render the new grouped line items (booking name → lines → subtotal) above the existing pricing schedule. The pricing schedule (deposit/balance milestones) stays as-is.
- `src/components/trips/InvoicePreviewDialog.tsx`: same grouped rendering for the agent-side preview.

If the invoice schema doesn't already store grouped line items, add a lightweight `invoice_line_items` table:

```text
invoice_line_items
  id uuid pk
  invoice_id uuid fk -> invoices(id) on delete cascade
  booking_id uuid null
  booking_name text
  description text
  amount numeric
  is_optional boolean default false
  sort_order int
```

with RLS mirroring `invoices` (owner read/write, plus the existing portal access path used by `PortalInvoiceDetail`).

---

## 3. AI chat — group trips and tasks

The current `AgentChatWidget` is human↔human only. Add an AI assistant view backed by the existing `mcp-server` edge function plus a thin chat endpoint.

**Frontend (`AgentChatWidget.tsx`)**:
- Add a new "Ask AI" entry alongside Team / DMs.
- Chat panel renders messages with `react-markdown`.
- Conversations stored in a new `ai_chat_conversations` + `ai_chat_messages` table (owner-scoped RLS) so context survives across sessions.

**Backend (new edge function `ai-chat`)**:
- Uses Lovable AI Gateway (`LOVABLE_API_KEY` already configured) with `google/gemini-2.5-pro` and tool-calling.
- System prompt: "You are the Crestwell agent assistant. Use tools to read tasks, search trips/leads, and create group trips on behalf of the signed-in agent."
- Tools exposed (call into existing patterns):
  - `list_today_tasks(filter?)` — pulls from `workflow_tasks`, sorted by urgency / departure proximity.
  - `search_tasks({ query, trip_id?, status? })`.
  - `create_task({ title, due_at, trip_id?, assignee_id? })` — inserts into `workflow_tasks`.
  - `create_group_trip({ destination, rough_dates, notes, parent_trip_id? })` — inserts a parent trip with `is_group = true` (using existing groups hierarchy pattern), then asks the user to confirm the spun-up details. Reuses the existing trip insertion logic from `AddTripDialog` patterns.
- All writes go through the user's auth context (forward `Authorization` header to a `userClient`) so RLS still applies.

**Memory / streaming**: full message history sent on each call (per chatbot best practices). Non-streaming response is fine for v1.

---

## 4. Quality-of-life bundle

**a) Standalone Branding page**
- `src/pages/Branding.tsx` already exists at its own route. Switch from explicit "Save" buttons to debounced auto-save (~600ms after last change) via `saveSettings`. Show a small "Saved" indicator. Logo/cover photo upload remain explicit actions.

**b) `{{last_name}}` email variable**
- `supabase/functions/send-email/index.ts`: when rendering templates, also substitute `{{first_name}}` and `{{last_name}}` derived from the recipient's client/profile record (split `full_name` on the last space when no dedicated columns exist).
- `src/components/clients/SendEmailDialog.tsx` + email Library UI: list `{{last_name}}` in the variables picker.

**c) Resend pending agency invitations**
- `useInvitations.resendInvitation` already exists. Verify the "Resend" button is wired on `src/pages/TeamManagement.tsx` for pending rows; if missing, add it next to Revoke. (Plan keeps this small — likely a one-line UI addition.)

**d) Project Expedition transfer notes**
- Project Expedition isn't currently integrated. For this release, add a generic "Supplier notes" prepend behavior to transfer-type bookings: when a booking with `line_type = 'transfer'` has `metadata.supplier_notes` (meeting point, contact info), prepend it to the booking description shown in `BookingCard.tsx`, `PortalTripDetail.tsx` itinerary, and `SharedTripItinerary.tsx`. Wire-up to a real Project Expedition feed can be a follow-up once that connector exists.

---

## Technical details

- **Migrations**: one migration for `booking_margin_lines.is_internal` + `invoice_line_items` table with RLS.
- **Edge functions to redeploy**: `shared-trip`, `portal-data`, `generate-tern-invoices`, `send-email`, plus new `ai-chat`.
- **No changes to** `calculate_booking_margin` — internal lines already roll into totals because they live in `booking_margin_lines`.
- **AI provider**: Lovable AI Gateway (`google/gemini-2.5-pro`) — no new secrets required.
- **No new third-party connectors** — Project Expedition stays a local "supplier notes" passthrough until a real feed is added.

---

## Out of scope

- Real Project Expedition API integration (would need a dedicated connector + secrets).
- Streaming AI responses.
- Editing existing legacy invoices to backfill the new grouped line items — only newly generated invoices get the breakdown.
