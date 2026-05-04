# Email Activity Dashboard

Build an admin-only dashboard to monitor outgoing emails — sends, failures, retries — with filters by template (campaign) and date range.

## Current state

- Single `send-email` Edge Function uses Resend; logs to `public.email_logs` only on success and only when a `clientId` is provided.
- No failure rows, no retry tracking, no Resend message ID stored.
- `useEmailLogs` hook exists but is scoped per-client.
- Many callers across the app invoke `send-email` (post-trip, payment receipts, eticket, invitations, nurture, proposals, etc.).

## Changes

### 1. Database (migration)

Extend `public.email_logs` so it can capture every send attempt:

- Add columns:
  - `provider_message_id text` — Resend ID for delivery correlation
  - `error_message text` — failure reason
  - `attempt_count int not null default 1`
  - `metadata jsonb` — caller context (trip_id, booking_id, etc.)
- Make `client_id` and `user_id` nullable (system emails like invitations have no client).
- Allow `status` values: `sent`, `failed`, `retrying`, `bounced`.
- Indexes on `(created_at desc)`, `(template)`, `(status)`.
- RLS: admins/office_admin can read all rows; service role inserts bypass RLS.

### 2. Edge Function `send-email`

- Always insert a log row (even without `clientId`).
- On Resend success: insert with `status='sent'` + `provider_message_id`.
- On Resend failure: insert with `status='failed'` + `error_message`, then perform up to 2 retries with exponential backoff (1s, 3s). Each attempt updates `attempt_count` on the same row (keyed by an `idempotency_key` we generate at request start) instead of inserting duplicates.
- Accept optional `metadata` from callers and persist it.

### 3. New hooks

- `useEmailActivity({ from, to, templates, statuses })` — admin-scoped query against `email_logs` with filters, ordered by `created_at desc`, paginated 25/page.
- `useEmailActivityStats({ from, to, templates })` — aggregates: total sends, sent, failed, retry count (sum of `attempt_count - 1`), success rate. Also returns daily timeseries `{ date, sent, failed }` for the chart.
- `useEmailTemplatesList()` — `select distinct template` for the filter dropdown.

### 4. New page `/email-activity` (admin only)

Wrapped in `AdminRoute`, registered in `src/App.tsx`, linked from `Sidebar.tsx` under an "Operations" / "Communications" group.

Layout:

```text
+----------------------------------------------------------+
| Email Activity                                           |
| [Date range] [Template ▾] [Status ▾]      [Export CSV]   |
+----------------------------------------------------------+
| Total: 412 | Sent: 398 | Failed: 14 | Retries: 22 | 96.6%|
+----------------------------------------------------------+
| Sends over time (stacked bar: sent vs failed, by day)    |
+----------------------------------------------------------+
| Table: time | template | recipient | status | attempts   |
|        | error (expand) | metadata (drawer)              |
+----------------------------------------------------------+
```

Components:
- `src/pages/EmailActivity.tsx`
- `src/components/email/EmailActivityFilters.tsx` — preset ranges (24h, 7d, 30d) + custom datepicker.
- `src/components/email/EmailActivityStats.tsx` — stat cards.
- `src/components/email/EmailActivityChart.tsx` — recharts stacked bar by day.
- `src/components/email/EmailActivityTable.tsx` — sortable, paginated, expandable error row, drawer for metadata.
- `src/components/email/EmailStatusBadge.tsx`.

Charts use `recharts` (already in repo). CSV export reuses `src/lib/csvExport.ts`.

### 5. Sidebar & route

- Add `/email-activity` to `src/App.tsx` behind `AdminRoute`.
- Add nav link in `Sidebar.tsx` (icon: `Mail`).

## Out of scope

- No changes to per-client email panel (`useEmailLogs` keeps working — same table).
- No bounce/complaint webhooks from Resend (can be added later; schema is ready).
- No re-send-from-dashboard action in this pass (can be added once retry endpoint is stable).

## Acceptance

- Admin can open `/email-activity`, see today's sends/failures, filter by date range and template, see retry counts, export CSV.
- A failed Resend send produces a `failed` row with the error; retries increment `attempt_count` on the same row.
- Per-client email view in `ClientDetail` still works.
