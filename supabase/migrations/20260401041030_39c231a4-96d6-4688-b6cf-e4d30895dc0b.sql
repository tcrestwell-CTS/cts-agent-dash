-- Drop the old 4-param overload
DROP FUNCTION IF EXISTS public.calculate_booking_margin(uuid, numeric, boolean, text);

-- Allow rpc_call as triggered_by
ALTER TABLE public.booking_margin_audit DROP CONSTRAINT IF EXISTS booking_margin_audit_triggered_by_check;
ALTER TABLE public.booking_margin_audit ADD CONSTRAINT booking_margin_audit_triggered_by_check
  CHECK (triggered_by = ANY (ARRAY['create','update','manual','backfill','api','rpc_call']));