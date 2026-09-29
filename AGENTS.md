# Project Architecture Rules

- Keep authenticated advisor writing assistance in the existing `itinerary-ai-action` function so itinerary and trip-page copy share one guarded AI boundary.
- RateHawk booking (hotel_page→prebook→form→finish→status) lives in `supabase/functions/ratehawk/booking.ts`; guest deposit is a Stripe client-account PaymentIntent verified server-side before `booking/finish`, and RateHawk is paid from the ETG B2B deposit — keeps supplier and guest money separate.
- RateHawk booking error/status codes live only in `supabase/functions/ratehawk/errors.ts` (sourced from ETG docs), and booking.ts classifies every upstream reply through it — one table keeps retry/terminal behavior consistent across form, finish and status.
- RateHawk post-booking (order_info, cancel_quote, cancel_booking) lives in `ratehawk/booking.ts`; order/info is source of truth for status and the guest Stripe refund is deposit × (RateHawk refunded ÷ sell) — refunds follow what RateHawk actually confirms, not cached policy.
