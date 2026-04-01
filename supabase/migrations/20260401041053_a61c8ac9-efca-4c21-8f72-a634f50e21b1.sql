-- Directly update the booking with correct values since we know the math
-- gross_margin = 2219.52 - 2136.52 = 83.00
-- advisor (95%) = 78.85, agency (5%) = 4.15
-- commission_revenue = advisor share = 78.85
UPDATE public.bookings SET
  net_sales = 83.00,
  agency_gross_margin = 83.00,
  advisor_margin_amount = 78.85,
  agency_margin_amount = 4.15,
  commission_revenue = 78.85,
  commissionable_amount = 83.00,
  margin_version = margin_version + 1
WHERE id = '284d9cbe-1dc4-4c09-949c-187e9b82df2d';

-- Update the trip totals
UPDATE public.trips SET
  total_commission_revenue = 78.85,
  total_net_sales = 83.00
WHERE id = '72cc4ad3-b8af-4f47-92d1-eae2dd8b4b82';