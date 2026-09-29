// RateHawk / ETG booking error table. Source: docs.emergingtravel.com
// (B2B API → Booking → Create / Start / Check booking process, fetched 2026-09-29).
// Every code below is named in ETG's docs; nothing is invented.
//
// kind:
//  - "continue"  : not a failure — move on to the next step / keep polling
//  - "retry_new_id": retry booking/form with a NEW partner_order_id (ETG rule, max 10)
//  - "rebook"    : terminal for this rate — advisor must search/prebook again
//  - "fix_input" : terminal until advisor corrects the submitted data
//  - "contact"   : terminal, needs ETG account manager / API support
export type Stage = "form" | "finish" | "status" | "cancel" | "info";
export type Kind = "continue" | "retry_new_id" | "rebook" | "fix_input" | "contact";
export interface ErrDef { kind: Kind; retryable: boolean; message: string }

const T = (kind: Kind, message: string): ErrDef => ({
  kind, retryable: kind === "continue" || kind === "retry_new_id", message,
});

// Transient codes shared by all three endpoints (ETG uses "unknown"; our cert
// checklist says "unknown_error" — accept both).
const TRANSIENT = ["timeout", "unknown", "unknown_error"];

export const FORM_ERRORS: Record<string, ErrDef> = {
  timeout: T("retry_new_id", "RateHawk timed out creating the booking form; retrying automatically."),
  unknown: T("retry_new_id", "RateHawk had an internal error creating the booking form; retrying automatically."),
  unknown_error: T("retry_new_id", "RateHawk had an internal error creating the booking form; retrying automatically."),
  double_booking_form: T("retry_new_id", "A booking form already exists for this reference (usually a timed-out earlier attempt); continuing with a fresh reference."),
  duplicate_reservation: T("retry_new_id", "This booking reference was already used; continuing with a fresh reference."),
  rate_not_found: T("rebook", "This rate has expired or is no longer offered. Search the hotel again and pick a current rate."),
  hotel_not_found: T("rebook", "RateHawk no longer recognises this hotel. Search again."),
  contract_mismatch: T("rebook", "This rate was found under a different RateHawk contract. Search again and book from a fresh result."),
  sandbox_restriction: T("fix_input", "Real hotels can't be booked in the sandbox (and the test hotel can't be booked in production). Use the right hotel for this environment."),
  insufficient_b2b_balance: T("contact", "Our RateHawk credit balance is too low for this booking. Contact the RateHawk account manager before retrying."),
  reservation_is_not_allowed: T("contact", "Our RateHawk contract isn't allowed to make this booking. Contact the RateHawk account manager."),
};

export const FINISH_ERRORS: Record<string, ErrDef> = {
  // ETG: timeout/unknown/5xx on finish do NOT mean it failed — go check status.
  timeout: T("continue", "RateHawk is slow to respond; checking the booking status."),
  unknown: T("continue", "RateHawk returned an internal error; checking the booking status."),
  unknown_error: T("continue", "RateHawk returned an internal error; checking the booking status."),
  double_booking_finish: T("continue", "This booking was already submitted; checking its status instead of submitting twice."),
  book_hash_not_found: T("rebook", "RateHawk couldn't find this rate anymore. Search again and choose another rate."),
  rate_not_found: T("rebook", "This rate is no longer available. Search the hotel again."),
  booking_form_expired: T("rebook", "The booking session expired before it was completed. Re-price the room (prebook) and book again."),
  order_not_found: T("rebook", "RateHawk can't find this booking session. Re-price the room (prebook) and book again."),
  chosen_payment_type_was_not_available_on_booking_form: T("contact", "The payment method sent to RateHawk doesn't match what the booking form allowed. Contact tech support."),
  incorrect_chosen_payment_type: T("contact", "The payment amount/currency sent to RateHawk doesn't match the booking form. Contact tech support."),
  credit_card_required: T("contact", "This rate requires a credit card at RateHawk and can't be paid from our deposit account. Choose a different rate."),
  not_enough_credit_card_data: T("contact", "This rate requires card details at RateHawk. Choose a rate payable from our deposit account."),
  incorrect_init_uuid_format: T("contact", "Card payment data was rejected by RateHawk. Contact tech support."),
  incorrect_pay_uuid_format: T("contact", "Card payment data was rejected by RateHawk. Contact tech support."),
  card_type_not_supported: T("contact", "This card type isn't accepted for this rate. Choose a different rate."),
  return_path_required: T("contact", "This rate needs an online payment redirect we don't support. Choose a rate payable from our deposit account."),
  invalid_params: T("fix_input", "RateHawk rejected the guest details (e.g. digits or symbols in a name — only letters, spaces and - , . ’ are allowed). Correct them and submit again."),
  email: T("fix_input", "The guest email address was rejected. Correct it and submit again."),
  incorrect_guests_number: T("fix_input", "Adult names don't match the number of adults searched. Fix the guest list (or search again with the right party)."),
  incorrect_children_data: T("fix_input", "Children or their ages don't match the search. Fix the guest list (or search again with the right ages)."),
  incorrect_rooms_number: T("fix_input", "Number of rooms doesn't match the search. Fix the rooms (or search again)."),
  arrival_date_differs_from_checkin_date: T("fix_input", "Arrival date doesn't match the searched check-in date. Search again with the right dates."),
  invalid_upsell_attributes: T("fix_input", "Early check-in / late check-out selection was rejected. Remove or change it."),
  invalid_upsell_uid: T("fix_input", "Early check-in / late check-out selection was rejected. Remove or change it."),
  invalid_upsell_data: T("fix_input", "Only early check-in and late check-out (max two) can be added. Adjust the extras."),
  unauthorized_group_booking: T("contact", "Too many rooms/bookings at one hotel or on the same dates for an API booking. This needs a RateHawk group booking request."),
  insufficient_b2b_balance: T("contact", "Our RateHawk credit balance is too low for this booking. Contact the RateHawk account manager."),
  sandbox_restriction: T("fix_input", "The test hotel can't be booked in production. Use a real hotel."),
  supplier_data_required: T("contact", "RateHawk requires extra supplier data for our integration. Contact the RateHawk account manager."),
  no_pricing_data: T("contact", "Our RateHawk contract isn't active for pricing. Retry later; if it persists contact the account manager."),
};

export const STATUS_ERRORS: Record<string, ErrDef> = {
  timeout: T("continue", "Still waiting on RateHawk; checking again."),
  unknown: T("continue", "RateHawk had a temporary error; checking again."),
  unknown_error: T("continue", "RateHawk had a temporary error; checking again."),
  soldout: T("rebook", "The room sold out before the hotel confirmed. It's no longer available — search again and pick another room."),
  book_limit: T("rebook", "RateHawk's booking cut-off for this rate was reached (too close to check-in or limit hit). Search again for another rate or hotel."),
  provider: T("rebook", "The hotel's supplier had a technical error and didn't confirm. Search again and try another rate."),
  block: T("contact", "RateHawk couldn't hold the payment funds for this booking. Contact tech support."),
  charge: T("contact", "RateHawk couldn't take payment for this booking. Contact tech support."),
  "3ds": T("contact", "RateHawk's card security check failed. Contact tech support."),
  not_allowed: T("contact", "Our RateHawk contract isn't allowed to finish this booking. Contact RateHawk API support with the hotel, RateHawk order ID and guest names."),
  order_not_found: T("rebook", "RateHawk can't find this booking. Re-price the room and book again."),
  booking_finish_did_not_succeed: T("rebook", "RateHawk never accepted the booking submission. Re-price the room and book again."),
  lock: T("contact", "RateHawk locked this booking. Contact RateHawk API support."),
  overdue_debt: T("contact", "Our RateHawk account has an overdue balance, so bookings are blocked. Contact the RateHawk account manager."),
  decoding_json: T("contact", "RateHawk couldn't read our request. Contact tech support."),
  invalid_params: T("contact", "RateHawk rejected our request parameters. Contact tech support."),
  endpoint_exceeded_limit: T("contact", "We hit RateHawk's request limit. Wait a minute, then check status again."),
  endpoint_not_active: T("contact", "This RateHawk endpoint isn't enabled on our contract. Contact the account manager."),
  endpoint_not_found: T("contact", "RateHawk endpoint not found. Contact tech support."),
  unexpected_method: T("contact", "RateHawk rejected the request method. Contact tech support."),
  incorrect_credentials: T("contact", "RateHawk rejected our credentials. Contact tech support."),
  invalid_auth_header: T("contact", "RateHawk rejected our credentials. Contact tech support."),
  no_auth_header: T("contact", "RateHawk credentials missing on the proxy. Contact tech support."),
  not_allowed_host: T("contact", "RateHawk rejected our server's IP address. Contact tech support."),
};

// Cancel booking (docs: B2B API → Post booking → Cancel booking, fetched 2026-09-29).
// ETG documents exactly: order_not_found, order_not_cancellable, sandbox_restriction,
// lock, unknown. "Already cancelled" has no own code — ETG returns order_not_found
// for orders not in completed/rejected state, so we confirm via order/info.
// "continue" here = outcome unknown, verify via order/info before deciding.
export const CANCEL_ERRORS: Record<string, ErrDef> = {
  timeout: T("continue", "RateHawk timed out on the cancellation; checking the order to see if it went through."),
  unknown: T("continue", "RateHawk had an internal error cancelling; checking the order to see if it went through."),
  unknown_error: T("continue", "RateHawk had an internal error cancelling; checking the order to see if it went through."),
  lock: T("continue", "A cancellation for this order is already in progress; checking the order instead of sending it twice."),
  order_not_found: T("continue", "RateHawk says this order isn't cancellable in its current state (it may already be cancelled); checking the order."),
  order_not_cancellable: T("contact", "RateHawk refused the cancellation: the stay has already started, or our contract can't cancel non-refundable bookings. Contact the RateHawk account manager."),
  sandbox_restriction: T("fix_input", "A real hotel can't be cancelled in the sandbox (or the test hotel in production). Use the matching environment."),
};

// Retrieve bookings (order/info). Only documented code: page_out_of_range.
export const INFO_ERRORS: Record<string, ErrDef> = {
  timeout: T("continue", "RateHawk timed out fetching the order; try again shortly."),
  unknown: T("continue", "RateHawk had a temporary error fetching the order; try again shortly."),
  unknown_error: T("continue", "RateHawk had a temporary error fetching the order; try again shortly."),
  page_out_of_range: T("contact", "RateHawk returned no page for this order lookup. Contact tech support."),
};

const TABLES: Record<Stage, Record<string, ErrDef>> = { form: FORM_ERRORS, finish: FINISH_ERRORS, status: STATUS_ERRORS, cancel: CANCEL_ERRORS, info: INFO_ERRORS };

/** Normalise a RateHawk error payload to a code string. */
export function errorCode(e: unknown): string | null {
  if (e == null) return null;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const o = e as any;
    return (typeof o.code === "string" && o.code) || (typeof o.error === "string" && o.error) || JSON.stringify(o);
  }
  return String(e);
}

/** Classify. HTTP 5xx / network errors are transient per ETG. Unlisted codes are
 *  terminal "contact" — never silently retried, never a generic failure. */
export function classify(stage: Stage, code: string | null, httpStatus?: number): ErrDef & { code: string } {
  if ((httpStatus && httpStatus >= 500) || code === "network") {
    const c = code && TABLES[stage][code] ? code : "timeout";
    return { code: code ?? `http_${httpStatus}`, ...TABLES[stage][c] };
  }
  if (code && TABLES[stage][code]) return { code, ...TABLES[stage][code] };
  return {
    code: code ?? "unknown",
    ...T("contact", `RateHawk returned an unrecognised error "${code}". Contact tech support with the RateHawk order ID.`),
  };
}

export const isTransient = (code: string | null) => code != null && TRANSIENT.includes(code);
