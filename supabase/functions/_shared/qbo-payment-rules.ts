// Any row marked paid with a date and positive amount is a real receipt, including
// cash/check installments that carry no payment method or Stripe receipt.
export function isRealClientPayment(payment: {
  status?: string; amount?: number | string; payment_date?: string | null;
}) {
  return payment.status === "paid" && Number(payment.amount) > 0 && Boolean(payment.payment_date);
}

export function paymentRequestId(id: string) {
  return `cp-${id}`;
}

/** Find an existing QBO invoice for this customer whose DocNumber is one of the
 *  trip's invoice numbers or an advisor-suffixed variant of it. */
export function pickExistingInvoice(
  found: Array<{ Id?: string; DocNumber?: string; CustomerRef?: { value?: string } }>,
  customerId: string, docNumbers: string[],
): string | null {
  const hit = found.find((i) => String(i?.CustomerRef?.value) === String(customerId) &&
    docNumbers.some((d) => i.DocNumber === d || String(i.DocNumber ?? "").startsWith(`${d.substring(0, 15)}-`)));
  return hit?.Id ? String(hit.Id) : null;
}
