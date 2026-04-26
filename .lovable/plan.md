
# Audit: CTS Travel CRM vs. Pasted Spec

**Scope:** Read-only audit. No code changes. The app already exists as a mature production CRM (Crestwell Travel Services) — the spec largely overlaps with what's built. This audit focuses on the four priorities you selected.

---

## What the spec asks for vs. what exists

| Spec area | Status | Notes |
|---|---|---|
| Tech stack (React + Vite + Tailwind + Supabase + React Query) | ✅ Matches exactly | |
| Data models: clients, trips, quotes, bookings, payments, tasks, activities, profiles | ✅ All exist | Tables: `clients`, `trips`, `quotes`, `bookings`, `trip_payments`, `workflow_tasks`, `activities`, `profiles` |
| Top bar: global search + New Trip / Send Quote / Add Client | ✅ Built | `TopBar.tsx` + `QuickActions.tsx` |
| Section 1 — TODAY (tasks, payments, departures) | ✅ Built | `TodayPanel.tsx` + `NextActions.tsx` |
| Section 2 — PIPELINE cards | ✅ Built | `PipelineCards.tsx` (Quotes / Pending / Confirmed) |
| Section 3 — CONVERSION (Quotes Sent, Bookings Confirmed, Conversion %) | ⚠️ Partial | Dashboard computes `quotesSent`, `confirmedTrips`, and a conversion %, but the conversion % is *clients-with-bookings / total clients*, not *bookings / quotes sent*. No dedicated Conversion card. |
| Section 4 — REVENUE SNAPSHOT (Revenue MTD, Avg Booking Value) | ⚠️ Partial | `BusinessSnapshot` shows Revenue MTD but no Avg Booking Value. |
| Section 5 — FOLLOW-UP list (>48h since quote sent) | ⚠️ Partial | Counted in `computed.followUps` (using >3 days, not 48h) and surfaced in `NextActions`, but there is no dedicated row-level list with client name / trip value / last contacted / "Send Reminder" CTA. `OpsAlerts.tsx` has a 7-day variant. |
| Section 6 — RECENT ACTIVITY feed | ✅ Built (non-realtime) | `ActivityFeed.tsx` driven by a 5-min staleTime React Query, not Supabase Realtime |
| Quote funnel: sent_at / viewed_at / approved_at | ❌ Missing two of three | `quotes.sent_at` exists; **no `viewed_at`, no `approved_at`** on `quotes`. Trip-level approvals use `itinerary_approved_at`, but quote-level funnel timestamps are not tracked. |
| Auto-create follow-up task when quote is sent | ⚠️ Partial | `useWorkflowAutomation.processStatusChange("proposal_sent")` already creates a workflow task **due in 7 days**. Spec asks for **2 days**. Also only fires on the trip status transition to `proposal_sent`, not on every quote send. |
| Realtime activity feed | ❌ Not realtime | No `supabase.channel(...).on('postgres_changes', …)` for activities/bookings on the dashboard. |
| Global search (clients, trips, bookings) | ⚠️ Partial | Search box just navigates to `/contacts?search=…` — does not search trips or bookings. |

Legend: ✅ done · ⚠️ partial / drift from spec · ❌ missing

---

## Priority gaps (the four you flagged)

### 1. Quote funnel tracking (sent / viewed / approved) — ❌ biggest gap
**Current:** `quotes` table has only `sent_at`. There is no `viewed_at` or `approved_at`. The shared-trip page (`/shared/:token`) does not log views back to the database, and client approvals on shared/portal pages write to `trips.itinerary_approved_at`, not back to a quote row.

**To close:**
- Add `viewed_at`, `approved_at`, and (optional) `view_count` columns to `quotes`.
- Stamp `viewed_at` when the shared trip / portal proposal page is opened (first view only).
- Stamp `approved_at` when the client approves the itinerary/budget on the portal.
- Add a **Conversion / Funnel** card to the dashboard: Sent → Viewed → Approved → Booked, with %s.

### 2. Auto follow-up task on quote sent — ⚠️ exists but drifted
**Current:** `useWorkflowAutomation.ts` (line 67) creates a follow-up task **7 days** out, only when a trip moves to `proposal_sent`. Dashboard's "follow-ups" computation uses **>3 days** since `proposal_sent_at`. Spec wants **2 days**.

**To close:**
- Decide the canonical interval (spec says 48h / 2 days). Recommend **2 days**.
- Update both: the task `due_at` in `useWorkflowAutomation` and the `>3 days` filter in `DashboardContent.tsx` (line 85) and `OpsAlerts.tsx` (`>7 days`, line 118).
- Optionally trigger from `quotes.sent_at` updates as well, so individual quote sends (not just trip status changes) create the task.

### 3. Realtime activity feed — ❌ missing
**Current:** `ActivityFeed` is a React Query call with `staleTime: 5 min` over recent bookings. It does not subscribe to Supabase Realtime. (Other parts of the app do — `useAgentNotifications`, `useAgentMessages`.)

**To close:**
- Enable realtime publication on `activities` (and/or `bookings`).
- In `DashboardContent` / `ActivityFeed`, subscribe to `postgres_changes` and either prepend new rows or invalidate the query on insert.
- Consider switching the feed source from `bookings` to the dedicated `activities` table for a true unified feed (quote_sent, booking_confirmed, payment_received, client_added) — that table already exists via `useActivities`.

### 4. Conversion + Revenue snapshot cards — ⚠️ partial
**Current:**
- `BusinessSnapshot` shows Revenue MTD but no Avg Booking Value.
- Conversion is computed as *clients with bookings / total clients*, which is a customer-conversion metric, not the spec's *quote → booking* funnel.

**To close:**
- Add **Average Booking Value** to `BusinessSnapshot` (sum of confirmed booking gross / count).
- Add a **Conversion** card: `bookings_confirmed_this_period / quotes_sent_this_period` with a small Sent / Booked breakdown. This pairs naturally with the funnel work in #1.
- Optionally add MTD/QTD/YTD toggles.

---

## Other notable drift (not in your priority list, flagged for awareness)

- **Global search** only searches clients. Spec calls for clients + trips + bookings. Easy upgrade if you want it later.
- **Status vocabulary mismatch:** spec uses `lead/quoted/booked/completed`; codebase mixes `quoted`, `proposal_sent`, `booked`, `confirmed`, `completed`. `DashboardContent` filters on `"quoted"` while `OpsAlerts` and `useWorkflowAutomation` use `"proposal_sent"`. Worth normalizing in a future pass.
- **Follow-up list UI:** the spec's "row per client with Send Reminder CTA" is not built. It's currently only a count in the Today panel.

---

## Recommendation (proposed next implementation pass)

If you want to act on this audit, a focused, low-risk follow-up build would be:

1. **Migration:** add `viewed_at`, `approved_at`, `view_count` to `quotes`.
2. **Wire view/approval stamping** on the shared trip + portal approval flows.
3. **Normalize the follow-up interval to 2 days** in `useWorkflowAutomation`, `DashboardContent`, and `OpsAlerts`.
4. **Add a Funnel/Conversion card and Avg Booking Value** to the dashboard.
5. **Subscribe `ActivityFeed` to Supabase Realtime** on `activities` (after enabling the publication).
6. *(Optional)* Build the dedicated **Follow-up list** with "Send Reminder" CTA that calls `send-email` with the existing reminder template.

Approve this audit and I can either (a) stop here, or (b) immediately scope the implementation pass above into a separate plan to switch into build mode.

---

## Technical reference (files touched if you proceed)

- DB migration: `quotes` add `viewed_at timestamptz`, `approved_at timestamptz`, `view_count int default 0`. Enable realtime on `public.activities`.
- `src/pages/SharedTrip.tsx`, `src/lib/publishedTrip.ts` — stamp `viewed_at` on first load.
- `src/components/client/PaymentAgreementStep.tsx` / portal approval handlers — stamp `approved_at`.
- `src/hooks/useWorkflowAutomation.ts` (line 67) — change `+7` to `+2` days.
- `src/components/dashboard/DashboardContent.tsx` (line 85) — change `> 3` to `>= 2`.
- `src/components/dashboard/OpsAlerts.tsx` (line 118) — align threshold.
- `src/components/dashboard/BusinessSnapshot.tsx` — add Avg Booking Value tile.
- New `src/components/dashboard/ConversionFunnelCard.tsx`.
- `src/components/dashboard/ActivityFeed.tsx` — add `supabase.channel('dashboard-activity').on('postgres_changes', …)`.
