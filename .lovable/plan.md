## Goal

1. Schedule `stripe-reconcile` to run automatically every day so Stripe deposits get reconciled without a human clicking the button.
2. Make Kandi (and `stripe-reconcile`) record their daily runs in `task_runs` so the Agent Health panel stops looking stale (last Kandi entry is April 16).

## Changes

### 1. `stripe-reconcile` edge function — allow cron invocation
Add a service-role / `x-agent-secret` auth path alongside the existing user bearer-token path (mirrors `recon-engine`). When invoked with the agent secret, run in "system" mode (no `userId` required) and write a `task_runs` row with summary (PIs scanned, matched, orphaned, local statuses repaired).

### 2. `kandi` edge function — record runs
Add `task_runs` insert at start (`status='running'`) and update at end (`success` / `error` + `result_summary`). Mirrors how other agents should log.

### 3. New pg_cron jobs (via `supabase--insert` — contains URLs/keys, not a schema migration)
- `stripe-reconcile-daily` — daily at `15 6 * * *` UTC (after recon-engine at 06:30), POSTs to `/functions/v1/stripe-reconcile` with `x-agent-secret` header and `{ "auto_fix_local_status": true }`.
- Leave existing `kandi-daily-sweep` (06:00) and `recon-engine-daily` (06:30) untouched.

### 4. Agent Health visibility
No UI change needed — once `task_runs` rows land, the existing `AgentHealthPanel` and `useTaskRuns` hook will surface them.

## Technical notes

- `stripe-reconcile` currently does `authHeader.startsWith("Bearer ")` then `getClaims`. New path: if `x-agent-secret` header matches `CW_AGENT_SECRET` (already in vault), skip user-token validation and use service-role client only.
- Cron command pattern (already used by `recon-engine-daily`):
  ```sql
  select net.http_post(
    url := '.../functions/v1/stripe-reconcile',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-agent-secret', current_setting('app.cw_agent_secret', true)
    ),
    body := '{"auto_fix_local_status": true}'::jsonb
  );
  ```
- `task_runs` columns to populate: `task_name`, `task_type='cron'`, `status`, `started_at`, `completed_at`, `duration_ms`, `result_summary`, `error_message`, `metadata` (counts).
- Do NOT touch `recon-engine` (already healthy) or any UI files.

## Out of scope

- Backfilling missing Kandi `task_runs` rows from April 16–May 19 (cron fired but nothing was written; that history is gone).
- Changing the Stripe Reconcile UI button behavior — it keeps working with the user-token path.
