
-- Backfill Angel Rouse loan CTS-LOAN-28472 with Stripe subscription + April payment
UPDATE public.loan_applications
SET stripe_customer_id = 'cus_UBAd4cNT3eOd4P',
    stripe_subscription_id = 'sub_1TNmWfPJljF0WNcYfWvV3Gw6',
    autopay_active = true,
    autopay_start_date = COALESCE(autopay_start_date, '2026-04-19'::date),
    updated_at = now()
WHERE id = '245fe4d9-3c11-42ec-b5ef-79ac119963f8';

UPDATE public.loan_payment_schedules
SET status = 'paid',
    paid_date = '2026-04-19'::date,
    stripe_payment_intent_id = 'pi_3TNnT6PJljF0WNcY2WiOBGIF',
    updated_at = now()
WHERE id = '2d1948d1-e648-4b0d-bc2c-edd432ee3af0';
