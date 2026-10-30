export function isRealClientPayment(payment: {
  status?: string; amount?: number | string; payment_date?: string | null;
  due_date?: string | null; payment_method?: string | null;
  stripe_session_id?: string | null; stripe_receipt_url?: string | null;
  payment_type?: string; details?: string | null;
}) {
  const scheduledOnly = payment.due_date && !payment.payment_method &&
    !payment.stripe_session_id && !payment.stripe_receipt_url &&
    (["installment", "final", "final_balance"].includes(payment.payment_type ?? "") ||
      /^(installment|final balance)/i.test(payment.details ?? ""));
  return payment.status === "paid" && Number(payment.amount) > 0 &&
    Boolean(payment.payment_date) && !scheduledOnly;
}

export function paymentRequestId(id: string) {
  return `client-payment-${id}`;
}