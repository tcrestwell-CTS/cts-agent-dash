## Goal
Stop the automated emails that are sending wrong invoices to clients.

## What's running today
Two scheduled jobs in the backend fire every day:

1. **`auto-payment-reminders-daily`** (14:00 UTC) — calls the `auto-payment-reminders` function and emails clients about upcoming/overdue trip payments.
2. **`send-invoice-statements-daily`** (13:00 UTC) — calls `send-invoice-statement` and emails clients a statement when a payment is due within 7 days.

Both are the likely source of the bad outgoing emails.

## Plan

1. Create a migration that **unschedules both cron jobs** so nothing fires automatically anymore:
   - `cron.unschedule('auto-payment-reminders-daily')`
   - `cron.unschedule('send-invoice-statements-daily')`
2. Leave the edge functions and the in‑app Payment Reminders page in place so you can still send a reminder **manually** when you want to. Only the automated daily blast is turned off.
3. No frontend changes — the manual "Send" button on the Payment Reminders page keeps working.

## How to turn it back on later
Re-running a migration with `cron.schedule(...)` for either job name will bring the automation back. I can also rebuild it as opt‑in per trip if you'd rather have control on a per‑client basis.

## Out of scope
- Investigating *why* the invoices were wrong (separate cleanup — happy to dig into the recent `email_send_log` / `invoice_email_log` rows after this is stopped).
- Removing the Payment Reminders UI.
