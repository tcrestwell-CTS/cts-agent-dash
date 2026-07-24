---
name: Payment flow reconciliation rules
description: How Stripe charges are applied to trip_payments and loan_payment_schedules by the daily-payment-report reconciler
type: feature
---
**Net-of-fee application.** Stripe charges are applied to `trip_payments` as **net (gross − Stripe fee)**. The `stripe_fee` is captured from `balance_transaction` and stored on `trip_payments.stripe_fee`. **Gross** is used only for matching against scheduled installment amounts.

**Matching order.** Reconciler matches charges to installments by:
1. Email + trip name/destination extracted from the Stripe description/metadata (case-insensitive substring, length ≥ 3).
2. Fallback: email-only across any of the client's trips.
Amount tolerance is ±$0.02 against gross.

**Loan payments.** If the charge corresponds to an active loan (client has a `loan_applications` row with a pending `loan_payment_schedules` entry matching the amount), mark that schedule row `paid` with the Stripe PI. Do **not** also create a `trip_payments` row. This fires `trigger_qbo_loan_repayment_posted` which posts principal + interest deposits in QBO.

Unmatched charges land in `exception_queue` (source_system=`stripe`) and are NOT pushed to QBO until resolved.