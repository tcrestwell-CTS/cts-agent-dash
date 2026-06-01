# Inbox-to-CRM Agent + Unified Approval Inbox

Deliver Tern's "the hire you never made" inside Crestwell: an agent that reads agent email and proposes CRM updates, plus a single queue where every AI agent's proposed actions get approved or rejected.

## What gets built

### 1. Unified Approval Inbox (foundation — build first)

A single queue surface where Tiara, Richard, Terrance, Ashley, Kandi, and the new Inbox agent all post "I want to do this, approve?" items instead of acting blind.

**New table** `ai_proposed_actions`:
- `id`, `user_id` (owning agent), `agent_name` (tiara/richard/terrance/ashley/kandi/inbox)
- `action_type` (e.g. `update_lead_status`, `draft_reply`, `add_payment`, `update_trip_dates`, `create_note`)
- `target_table`, `target_id` (what record it touches)
- `summary` (one-line human description), `reasoning` (why the agent proposed it)
- `proposed_changes` jsonb (the diff/payload to apply)
- `source` (e.g. `email:<message_id>`, `trigger:lead_qualified`)
- `status` (`pending` | `approved` | `rejected` | `applied` | `failed` | `auto_applied`)
- `confidence` numeric, `auto_apply_eligible` boolean
- `approved_by`, `approved_at`, `applied_at`, `error_message`, `created_at`
- RLS: agents see their own; admin/office_admin see all. Realtime enabled.

**New edge function** `apply-proposed-action`:
- Input: `{ action_id }`
- Loads the row, dispatches by `action_type` to the correct table update / edge function call, writes result back, sets `status='applied'` or `failed`.
- Single chokepoint so every agent uses the same approval path.

**New page** `/approvals` (sidebar item "Approvals" with unread badge):
- Filter by agent, action type, status, confidence
- Each card: agent avatar, summary, reasoning, before/after diff, source link (email / lead / trip), Approve / Reject / Edit buttons
- Bulk approve for high-confidence items
- Realtime updates via Supabase channel

**Refactor existing agents** (small touches, not rewrites):
- Tiara, Richard, Terrance, Ashley, Kandi: when they currently auto-write to CRM or send email, instead insert into `ai_proposed_actions` unless `auto_apply_eligible` and user has enabled auto-apply for that action type.
- Per-user `agent_auto_apply_settings` table so users can opt specific action types into skip-approval.

### 2. Inbox-to-CRM Agent ("Iris")

A new agent that watches an agent's Gmail/Outlook inbox, classifies each thread, and posts proposed CRM updates to the Approval Inbox.

**Connection** — use the Lovable gateway connector for Gmail (already on the gateway-enabled list). For Outlook users, Microsoft Outlook connector. Each user links their own mailbox via `standard_connectors--connect`.

**New table** `inbox_watched_mailboxes`:
- `user_id`, `provider` (gmail/outlook), `connection_id`, `last_history_id` / `last_synced_at`, `is_active`

**New table** `inbox_processed_messages`:
- `user_id`, `provider_message_id`, `thread_id`, `from_email`, `subject`, `received_at`, `classification`, `linked_lead_id`, `linked_trip_id`, `linked_booking_id`, `processed_at`
- Dedupe key so we never reprocess the same email twice.

**New edge function** `iris-poll` (runs every 5 min via pg_cron):
- For each active mailbox, fetch new messages since `last_history_id`
- Skip already-processed ones
- Call `iris-classify` per message

**New edge function** `iris-classify`:
- Uses Lovable AI (Claude via existing pattern) with the message body + thread context
- Classifies into: `supplier_confirmation`, `client_reply`, `pricing_change`, `payment_notice`, `itinerary_update`, `cancellation`, `noise`
- Matches sender/subject/body against existing leads, trips, bookings, suppliers (fuzzy email + reference number match)
- Extracts structured fields (confirmation #, new price, new dates, payment amount, etc.)
- Inserts one or more rows into `ai_proposed_actions` with `agent_name='iris'`, `source='email:<id>'`
- Examples produced:
  - Supplier confirmation email → `action_type='attach_confirmation'` on a booking
  - Client says "push trip back a week" → `action_type='update_trip_dates'` + a draft reply
  - Supplier sends new price → `action_type='update_margin_line'` with old/new sell price
  - Cruise line cancellation notice → `action_type='flag_booking_at_risk'`

**Sidebar entry** under Settings → "Inbox Sync" for the user to link their mailbox, see last sync time, pause/resume, and choose which action types auto-apply.

## Technical notes

- All new tables: explicit `GRANT` block, RLS scoped to `auth.uid()`, admin/office_admin read-all via `has_role`.
- Edge functions follow existing pattern: Deno, `npm:@supabase/supabase-js@2`, cors headers, JWT validated, secrets via Supabase vault.
- AI calls go through Lovable AI Gateway (Claude family per project standard — see `tech/infrastructure/ai-provider` memory).
- Gmail/Outlook tokens never touched in client code; refresh handled by the gateway.
- `apply-proposed-action` reuses existing RPCs (`calculate_booking_margin`, payment insert paths, trip update paths) so business logic stays in one place.
- Approvals page uses existing `useAgentNotifications` realtime pattern.
- pg_cron job `iris-poll-every-5min` added per `tech/infrastructure/extensions` conventions.

## Build order

1. `ai_proposed_actions` table + RLS + grants + realtime
2. `apply-proposed-action` edge function with handlers for 4–5 core action types
3. `/approvals` page + sidebar nav + unread badge
4. Refactor Tiara/Richard/Terrance/Ashley/Kandi to post proposals instead of (or alongside) direct writes — gated by per-user setting
5. Gmail connector wiring + `inbox_watched_mailboxes` + Settings → Inbox Sync UI
6. `iris-classify` + `iris-poll` + pg_cron schedule
7. Outlook support (same shape as Gmail)

## Out of scope for this plan

- Chrome extension for Travefy/Axus import (separate item from the earlier list — itinerary importer can be a follow-up)
- Bulk natural-language itinerary editor (separate follow-up)
- Reworking existing agents' core logic — we only intercept their write path
