

# Phase 5: Workflow Automation Engine

## Overview
Implement an event-driven workflow automation system that automatically transitions trip statuses and creates tasks/notifications based on specific triggers throughout the trip lifecycle.

## New Trip Statuses

The current default statuses (Inbound, Planning, Booked, Traveling, Traveled, Cancelled, Archived) need new intermediate statuses added to the seed defaults:

| New Status | Color | Position | Description |
|---|---|---|---|
| Proposal Sent | `#f97316` (orange) | After Planning (sort 2) | Agent published itinerary and sent proposal |
| Option Selected | `#06b6d4` (cyan) | After Proposal Sent (sort 3) | Client chose an option block alternative |
| Deposit Authorized | `#8b5cf6` (violet) | After Option Selected (sort 4) | Client submitted payment authorization |
| Deposit Paid | `#10b981` (emerald) | After Deposit Authorized (sort 5) | Deposit payment confirmed |
| Final Paid | `#059669` (green-dark) | After Deposit Paid (sort 6) | Full balance paid |

Updated sort order for existing statuses: Booked (7), Traveling (8), Traveled (9), Cancelled (10), Archived (11).

## Database Changes

### 1. New `workflow_tasks` table
Stores automated tasks created by the workflow engine.

```text
workflow_tasks
  id           UUID PK
  trip_id      UUID FK -> trips
  user_id      UUID (agent)
  title        TEXT
  description  TEXT
  task_type    TEXT (follow_up, prepare_invoice, charge_card, booking_completion, supplier_confirmation)
  status       TEXT (pending, completed, dismissed)
  due_at       TIMESTAMPTZ
  created_at   TIMESTAMPTZ
  completed_at TIMESTAMPTZ
```

RLS: Users see/manage their own tasks. Admins see all.

### 2. New columns on `trips` table
- `proposal_sent_at` TIMESTAMPTZ -- timestamp of when proposal was sent
- `follow_up_due_at` TIMESTAMPTZ -- 7-day follow-up deadline

## Implementation

### Task 1: Database Migration
- Create `workflow_tasks` table with RLS
- Add `proposal_sent_at` and `follow_up_due_at` columns to `trips`
- Update default seed statuses in `useTripStatuses.ts`

### Task 2: Workflow Engine Hook (`useWorkflowAutomation`)
A new hook that encapsulates all automation logic. It wraps `updateTripStatus` and intercepts status changes to perform validations and side effects.

**On "Proposal Sent":**
- Validate: trip must be published (`published_at` is not null)
- Validate: at least one itinerary item with a price exists (check bookings `gross_sales > 0`)
- Auto: set `proposal_sent_at = now()`, `follow_up_due_at = now() + 7 days`
- Auto: create `workflow_task` type `follow_up` due in 7 days
- Auto: create agent notification "Proposal sent for [trip_name]"

**On "Option Selected":**
- Auto: create `workflow_task` type `prepare_invoice` titled "Prepare Deposit Invoice"
- Auto: create agent notification
- Note: The actual trigger from client option selection will be handled in the portal/shared-trip flow (future enhancement). For now, the agent can manually move to this status.

**On "Deposit Authorized":**
- Auto: create `workflow_task` type `charge_card` titled "Charge Card for [trip_name]"
- Auto: create agent notification alerting advisor
- Auto: log compliance audit entry for T&C acceptance

**On "Deposit Paid":**
- Triggered when advisor logs a deposit payment or marks payment as paid
- Auto: move status to `deposit_paid`
- Auto: create `workflow_task` type `booking_completion`

**On "Final Paid":**
- Triggered when advisor logs final payment
- Auto: move status to `final_paid`
- Auto: create `workflow_task` type `supplier_confirmation` titled "Confirm Supplier Payments"

### Task 3: Update TripStatusWorkflow Component
- Replace hardcoded `WORKFLOW_STATUSES` array with the new expanded workflow
- Add validation gates (e.g., proposal_sent requires published itinerary)
- Show validation error messages when preconditions aren't met

### Task 4: Payment-Triggered Status Changes
- Modify `TripPayments.tsx` `handleMarkAsPaid` to call the workflow engine
- When a deposit payment is marked paid and trip is in `deposit_authorized` or `option_selected`, auto-transition to `deposit_paid`
- When a final payment is marked paid and trip is in `deposit_paid`, auto-transition to `final_paid`

### Task 5: Workflow Tasks Panel
- New `WorkflowTasks` component displayed on TripDetail page
- Shows pending tasks with due dates, dismiss/complete actions
- Overdue tasks highlighted in red
- Integrates into the existing trip detail sidebar or as a card above the tabs

### Task 6: Update Kanban & Status References
- Update `statusColors` map in `TripDetail.tsx` with new status colors
- Ensure `TripStatusWorkflow` progress bar shows all stages
- Update legacy status map in `useTripStatuses.ts`

## Technical Notes

- All automations run client-side in the workflow hook -- no new edge functions needed
- The hook intercepts `updateTripStatus` calls and performs pre/post actions
- Workflow tasks use the existing `agent_notifications` pattern for consistency
- The 7-day follow-up timer is stored as `follow_up_due_at` on the trip; a future cron job could automate reminder emails
- Existing trips with old statuses remain backward-compatible via the legacy status map

## Files Changed

| File | Action |
|---|---|
| `supabase/migrations/..._workflow_tasks.sql` | Create -- new table + trips columns |
| `src/hooks/useWorkflowAutomation.ts` | Create -- workflow engine hook |
| `src/components/trips/WorkflowTasks.tsx` | Create -- task panel component |
| `src/hooks/useTripStatuses.ts` | Edit -- update default statuses + legacy map |
| `src/components/trips/TripStatusWorkflow.tsx` | Edit -- expanded workflow stages + gates |
| `src/pages/TripDetail.tsx` | Edit -- integrate WorkflowTasks + wire automation |
| `src/components/trips/TripPayments.tsx` | Edit -- payment-triggered status changes |
| `src/hooks/useTrips.ts` | Edit -- add new fields to Trip interface |

