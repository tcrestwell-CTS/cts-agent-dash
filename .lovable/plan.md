

# Level 6: Scalability Architecture

Design the platform to support 30+ agents with granular permissions, automated commission tier progression, configurable approval thresholds, and commission holdback reserves.

---

## What Already Exists

- **RBAC**: Three roles (admin, office_admin, user) enforced via `user_roles` table and `has_role()` security definer function
- **Commission Tiers**: Static tiers (None, Tier 1: 70/30, Tier 2: 80/20, Tier 3: 95/5) manually assigned by admins
- **Override Approval**: Commission overrides exceeding calculated amounts require admin approval via `PendingOverridesCard`
- **Role-Scoped Views**: Sidebar navigation, team management, and analytics already filter by role
- **RLS Enforcement**: 100% coverage -- agents see only their own data, admins/office admins see all

---

## What's New

### 1. Agency Settings Table (Configurable Thresholds)

Create an `agency_settings` table to store agency-wide configuration that admins can adjust:

- `approval_threshold`: Dollar amount above which bookings require admin approval (default: $10,000)
- `commission_holdback_pct`: Percentage withheld from agent commission payouts until trip completion (default: 10%)
- `tier_auto_promote`: Whether automatic tier promotion is enabled (default: false)
- `tier_1_threshold`: Gross sales threshold to auto-promote to Tier 2 (default: $100,000)
- `tier_2_threshold`: Gross sales threshold to auto-promote to Tier 3 (default: $250,000)
- `evaluation_period_months`: Rolling period for tier evaluation (default: 12)

This is a single-row table scoped to the agency (keyed by the admin's user_id, readable by all authenticated users).

### 2. Approval Threshold on High-Value Bookings

Currently, only commission overrides require approval. Add a new approval gate:

- When an agent creates a booking with `gross_sales >= approval_threshold`, automatically flag it with `approval_required = true`
- Show these in the existing `PendingOverridesCard` (renamed to `PendingApprovalsCard`) alongside commission overrides
- Admins can approve or reject from the same interface
- Booking stays in `pending` status until approved; agents see a "Pending Admin Approval" badge

**Changes**:
- Add `approval_required` and `approval_type` columns to `bookings`
- Update booking creation logic in `useBookings.ts` to check threshold
- Expand `PendingOverridesCard` to show both override and threshold approvals

### 3. Commission Holdback Reserve

Implement a configurable holdback percentage on agent commission payouts:

- When a commission is created, calculate `holdback_amount = commission_amount * holdback_pct / 100`
- Store `holdback_amount` and `holdback_released` on the `commissions` table
- The holdback is released automatically when the trip status changes to `completed`
- Show holdback amounts in the Commissions page with "Held" and "Released" badges
- Add a "Commission Reserve" summary card on the admin dashboard showing total held vs. released

**Changes**:
- Add `holdback_amount`, `holdback_released`, `holdback_released_at` columns to `commissions`
- Update commission creation flow to calculate holdback based on agency settings
- Add a database trigger on trips status change to release holdbacks
- Update Commissions UI to display holdback status

### 4. Automatic Commission Tier Promotion

Add logic to evaluate agent performance and auto-promote tiers:

- Create a new database function `evaluate_agent_tiers()` that:
  - Sums each agent's gross sales over the rolling evaluation period
  - Compares against tier thresholds from `agency_settings`
  - Updates `profiles.commission_tier` if the agent qualifies for a higher tier
  - Logs the promotion in `compliance_audit_log` for audit trail
- This function can be called manually by admins via a "Re-evaluate Tiers" button, or scheduled via a cron-style edge function
- Agents are never auto-demoted (only promoted); demotion remains a manual admin action

**Changes**:
- Create `evaluate_agent_tiers()` database function
- Create `evaluate-tiers` edge function (callable by admins)
- Add "Re-evaluate Tiers" button on Team Management page
- Show tier change history in agent profiles

### 5. Agency Settings Admin UI

Add a new "Agency Settings" tab on the Settings page (admin-only) to configure:

- Approval threshold amount
- Commission holdback percentage
- Tier auto-promotion toggle and thresholds
- Evaluation period

This replaces hardcoded values with a configurable system.

### 6. Enhanced Permission Guards

For 30 agents, tighten permission enforcement:

- Add `useCanApproveBookings()` hook (returns true for admin only)
- Add `useCanEditSettings()` hook (returns true for admin only)
- Add `useCanViewFinancials()` hook (admin + office_admin)
- Consolidate all permission checks into a single `usePermissions()` hook that returns a permissions object
- Use this throughout the app instead of scattered `useIsAdmin` / `useIsOfficeAdmin` calls

---

## Database Changes

```sql
-- 1. Agency settings (single-row config table)
CREATE TABLE public.agency_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  approval_threshold numeric NOT NULL DEFAULT 10000,
  commission_holdback_pct numeric NOT NULL DEFAULT 10,
  tier_auto_promote boolean NOT NULL DEFAULT false,
  tier_1_threshold numeric NOT NULL DEFAULT 100000,
  tier_2_threshold numeric NOT NULL DEFAULT 250000,
  evaluation_period_months integer NOT NULL DEFAULT 12,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings
CREATE POLICY "Authenticated users can view agency settings"
  ON public.agency_settings FOR SELECT TO authenticated
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins can insert agency settings"
  ON public.agency_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update agency settings"
  ON public.agency_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Booking approval fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS approval_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_type text; -- 'high_value', 'override', null

-- 3. Commission holdback fields
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS holdback_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS holdback_released boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS holdback_released_at timestamptz;

-- 4. Trigger to release holdbacks when trip completes
CREATE OR REPLACE FUNCTION public.release_commission_holdbacks()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.commissions
    SET holdback_released = true,
        holdback_released_at = now(),
        updated_at = now()
    WHERE booking_id IN (
      SELECT id FROM public.bookings WHERE trip_id = NEW.id
    )
    AND holdback_released = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_release_holdbacks
  AFTER UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.release_commission_holdbacks();

-- 5. Index for performance at scale
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_booking_id ON public.commissions(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_approval ON public.bookings(approval_required) WHERE approval_required = true;
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useAgencySettings.ts` | Hook to read/update agency_settings; includes holdback and threshold config |
| `src/hooks/usePermissions.ts` | Consolidated permissions hook replacing scattered admin checks |
| `src/components/settings/AgencySettingsTab.tsx` | Admin UI for configuring thresholds, holdback %, tier promotion rules |
| `supabase/functions/evaluate-tiers/index.ts` | Edge function to evaluate and auto-promote agent tiers |

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useBookings.ts` | Check `approval_threshold` from agency settings during booking creation; set `approval_required` and `approval_type` |
| `src/hooks/useCommissions.ts` | Calculate `holdback_amount` on commission creation using agency settings holdback % |
| `src/components/commissions/PendingOverridesCard.tsx` | Rename to `PendingApprovalsCard`; show both high-value booking approvals and commission overrides |
| `src/pages/Commissions.tsx` | Add holdback summary cards (Total Held, Total Released, Net Payable) |
| `src/pages/Settings.tsx` | Add "Agency" tab for admin users with `AgencySettingsTab` |
| `src/pages/TeamManagement.tsx` | Add "Re-evaluate Tiers" button; show tier change history |
| `src/components/bookings/BookingCard.tsx` | Show "Pending Approval" badge for high-value bookings |
| `src/pages/BookingDetail.tsx` | Show approval status section for flagged bookings |
| `src/lib/commissionTiers.ts` | Add helper `getNextTier()` for tier promotion logic |
| `src/integrations/supabase/types.ts` | Auto-updated with new table/columns |

---

## Implementation Order

1. Database migration (agency_settings table, booking approval columns, commission holdback columns, holdback release trigger, indexes)
2. Create `useAgencySettings` hook
3. Create `usePermissions` hook
4. Create `AgencySettingsTab` component and add to Settings page
5. Update booking creation to check approval threshold
6. Expand `PendingOverridesCard` to handle both approval types
7. Update commission creation to calculate holdback
8. Update Commissions page with holdback UI
9. Create `evaluate-tiers` edge function
10. Add "Re-evaluate Tiers" to Team Management
11. Deploy edge functions

