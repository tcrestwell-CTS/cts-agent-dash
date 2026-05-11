## Payment Reminders Dashboard — reusing existing branded reminder

There is **already** a fully built, navy/gold branded reminder system in this project. We will reuse it instead of creating a parallel `payment_reminders` table.

### What already exists

- **Edge function `send-invoice-statement`** — sends branded "Initial Invoice" and "Friendly Payment Reminder" emails from `noreply@crestwellgetaways.com`. Uses navy/gold (`#0d1b2a` / `#c9a84c`) header, agency tagline/phone/logo from `branding_settings`, and mints a tokenized secure pay link to `crestwellgetaways.com/payment`. Supports per-invoice manual sends (`qbo_invoice_id` + `email_kind: 'manual'`) and a cron mode that auto-sends initial + 7-day reminders.
- **Edge function `payment-reminders`** — already runs `check_upcoming_payment_deadlines()` to create in-app advisor notifications for bookings due within 7 days.
- **Table `invoice_email_log`** — full send history with `email_kind` (`initial` / `reminder_7d` / `manual` / `test`), recipient, due date, amount, `resend_id`, sent_at.
- **Table `trip_payments`** — 48 unpaid installments with due dates today and forward (deposits, balance, final). This is the canonical "upcoming payments" source.
- **Table `qbo_invoices`** — currently empty in this environment, but linked via `crm_booking_id` when populated.

### What we will build

A new advisor page **`/payment-reminders`** that surfaces upcoming `trip_payments` and lets advisors fire the existing branded reminder from one screen.

**Page** — `src/pages/PaymentReminders.tsx` (route added in `App.tsx`, sidebar link added behind feature flag `payment_reminders`).

**Hook** — `src/hooks/usePaymentReminders.ts` reads:
- All `trip_payments` where `status != 'paid'` AND `due_date IS NOT NULL`, joined with `trips(trip_name, destination, client_id)` and `clients(name, email)`.
- Last `invoice_email_log` row per `trip_id` (for "Last sent" badge).
- Scoped to the advisor's own trips (RLS already enforces this); admins/office_admins see all.

**Filter bar + search** — All / Overdue / This Week / This Month / Sent (has invoice_email_log row in last 30d) / Unsent. Search by client name.

**Table view** — sortable columns: Client, Trip, Reminder Type (mapped from `payment_type`: deposit / balance_due / final_payment / installment), Amount Due, Due Date, Days Until Due, Last Sent, Actions. Row tint by urgency:
- Overdue → `bg-destructive/10`
- ≤7 days → amber tint
- ≤30 days → yellow tint
- > 30 days → emerald tint

Dates parsed via `parseLocalDate` to avoid UTC drift.

**Send Reminder modal** — `SendReminderDialog.tsx`. Shows a live preview of the branded email (re-uses the same `buildHtml` markup conceptually for the preview pane), with editable subject and an optional message-override textarea. On confirm:
- If the trip has a matched QBO invoice → invoke `send-invoice-statement` with `{ qbo_invoice_id, email_kind: 'manual' }` (existing path, no edge-function changes needed).
- Otherwise → invoke a small new edge function **`send-payment-reminder`** that wraps the same `buildHtml` branding but is sourced from a `trip_payment_id`. This keeps the email visually identical to the QBO-invoice reminder. Logs to `invoice_email_log` (`email_kind = 'manual'`, `qbo_invoice_id = 'TP-<uuid>'`) and `email_logs` (`template = 'payment_reminder'`) so existing dashboards keep working.

After a successful send, the row's "Send Reminder" button switches to "Resend" with the timestamp from the new log entry. React Query invalidation refreshes the list.

**Add Reminder dialog** — `AddReminderDialog.tsx`. Inserts a row into the existing `trip_payments` table (advisor selects the trip via `ClientSearchCombobox` → trip dropdown), with `payment_type`, `amount`, `due_date`, optional `details`. No new table is needed.

### Technical notes

- No new schema. The "payment_reminders" semantics are derived from existing `trip_payments` + `invoice_email_log`.
- New edge function is small (~120 lines) and shares the `buildHtml` style block with `send-invoice-statement` (copied inline; both functions stay self-contained per Deno conventions).
- All sends go through Resend with the existing `RESEND_API_KEY` secret. Auth is the user's Supabase JWT — no `CW_AGENT_SECRET` needed for advisor-initiated sends.
- Branding pulled live from `branding_settings` so it always matches the user's logo/colors.
- Sidebar entry added under "Communications" group, gated by a new `payment_reminders` feature key (defaults to allowed for all roles; admins can revoke via the existing AgentPermissionsManager).
