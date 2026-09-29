# Project Architecture Rules

- Keep authenticated advisor writing assistance in the existing `itinerary-ai-action` function so itinerary and trip-page copy share one guarded AI boundary.
- RateHawk booking (hotel_page→prebook→form→finish→status) lives in `supabase/functions/ratehawk/booking.ts`; guest deposit is a Stripe client-account PaymentIntent verified server-side before `booking/finish`, and RateHawk is paid from the ETG B2B deposit — keeps supplier and guest money separate.
