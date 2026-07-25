
## What's shipping

Turn each commission line into a reviewable "statement line" that supports multiple splits (agent, mentor, house, or custom), applies a mentor split automatically when the agent has one on file, and holds every change in a **draft** until an admin clicks **Confirm payout**.

## Data model (one migration)

New table `public.commission_splits`:
- `commission_id` (fk → commissions, cascade)
- `recipient_user_id` (fk → auth.users, nullable — null = "house")
- `role` text: `agent` | `mentor` | `house` | `custom`
- `percent` numeric(5,2) nullable, `amount` numeric(12,2) nullable (one required)
- `status` text: `draft` | `confirmed` | `paid` default `draft`
- `confirmed_at`, `confirmed_by`, `paid_date`, `notes`, standard timestamps
- Trigger: `updated_at`
- RLS: admins/office_admins full; recipients SELECT their own rows; bookkeepers SELECT
- GRANTs for `authenticated` + `service_role`

Extend `public.mentor_assignments`:
- `split_percent` numeric(5,2) default 0 (0–100, percent of mentee's agent share that goes to the mentor)
- `effective_from` date, `effective_to` date nullable

## UI

**1. `src/pages/TeamManagement.tsx` → "Team & billing" section**
- Per-agent Mentor row: pick mentor + split % + effective dates. Uses existing `useMentorAssignment` hook, extended.

**2. `src/components/reports/CommissionReportTable.tsx`**
- Each row gets an expand chevron → inline **Splits** editor:
  - Auto-seeds the agent's tier split + mentor split (if `mentor_assignments.split_percent` > 0 for that agent) + remainder to house.
  - Add/remove split rows; each is recipient + %|$ + note.
  - Live validation: splits must sum to 100% (or to commission amount).
  - Row-level "Received" checkbox becomes staged; edits live in local draft state.
- Sticky footer bar: "**X lines pending review · Y changes staged** · [Discard] [**Confirm payout**]". Confirm writes `commission_splits` rows (`status='confirmed'`), sets commissions `status='paid'` + `paid_date` for confirmed lines, and creates `commission_payments` entries per split.

**3. `src/pages/bookkeeper/BookkeeperPayouts.tsx`**
- Rework aggregation to sum from **confirmed `commission_splits`** grouped by `recipient_user_id`, not raw `commissions.user_id`. Adds a "Mentor earnings" column (splits where role=`mentor`).
- Same sticky **Confirm payout** bar for staged status/date changes.

**4. New hook `src/hooks/useCommissionSplits.ts`**
- `useCommissionSplits(commissionIds)` bulk fetch.
- `useStagedPayoutDraft()` (Zustand-lite in-memory state) tracks staged edits until confirm.
- `useConfirmPayout()` mutation that writes all staged rows in one RPC.

**5. Server RPC `confirm_commission_payout(p_edits jsonb)`**
- Admin/office_admin only.
- For each edit: upsert splits, mark commissions paid, insert `commission_payments`, log to `bookkeeper_audit_log`.
- Wrapped in a transaction so nothing partial-saves.

## Notes / trade-offs

- Reuses `commission_payments` for QBO — the existing `trigger_qbo_commission_received` still fires when commissions flip to paid.
- Mentor splits show up in the mentee's earnings breakdown as an outflow so their reported agent share stays correct.
- Non-admins keep read-only view of the report; the Confirm bar only renders for admin/office_admin.
- Skipping payroll-run/statement PDF for now — can layer on later.

## Files touched

- Migration: `commission_splits` table, `mentor_assignments` extensions, `confirm_commission_payout` RPC
- `src/hooks/useCommissionSplits.ts` (new), `src/hooks/useMentorAssignment.ts` (extend)
- `src/components/reports/CommissionReportTable.tsx` (splits UI + staging)
- `src/components/reports/CommissionConfirmPayoutBar.tsx` (new sticky bar)
- `src/pages/CommissionReport.tsx` (wire staging provider)
- `src/pages/bookkeeper/BookkeeperPayouts.tsx` (splits-aware rollup + confirm bar)
- `src/pages/TeamManagement.tsx` (mentor split % field)
