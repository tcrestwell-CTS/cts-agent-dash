INSERT INTO public.trip_payments (trip_id, user_id, amount, stripe_fee, payment_date, payment_method, payment_type, status, stripe_payment_intent_id, notes)
SELECT '378ec725-3b6f-4f55-bf14-b2bd4e2066d7', p.user_id, v.amount, 9.59, v.pdate, 'stripe', 'installment', 'paid', v.pi, v.note
FROM (SELECT user_id FROM public.trip_payments WHERE id = 'a0d557dc-e1e5-4472-be97-dc205ddb330d') p,
(VALUES
 (310.90::numeric, '2026-07-08'::date, 'pi_3Tr1R1PJljF0WNcY2GDQCsrl', 'Backfilled from Stripe subscription charge ch_3Tr1R1PJljF0WNcY2FVrD0tJ ($320.49 gross)'),
 (310.90::numeric, '2026-08-08'::date, 'pi_3U2GDePJljF0WNcY1FrtDLsk', 'Backfilled from Stripe subscription charge ch_3U2GDePJljF0WNcY12si9uMt ($320.49 gross)')
) AS v(amount, pdate, pi, note)
WHERE NOT EXISTS (SELECT 1 FROM public.trip_payments x WHERE x.stripe_payment_intent_id = v.pi);