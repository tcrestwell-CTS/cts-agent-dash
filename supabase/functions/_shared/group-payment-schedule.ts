// Payment schedule for group signups using the card-authorization flow.
// Mirrored byte-for-byte in supabase/functions/_shared/group-payment-schedule.ts (enforced by test).

export type PaymentPreference = "monthly" | "uplift" | "affirm";

export interface ScheduledPayment {
  payment_type: "deposit" | "installment" | "final_balance";
  amount: number;
  due_date: string; // YYYY-MM-DD
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);

function addMonths(d: Date, months: number): Date {
  const day = d.getUTCDate();
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

/** Final payment is due 30 days before departure. */
export function finalPaymentDate(departDate: string): string {
  const d = parse(departDate);
  d.setUTCDate(d.getUTCDate() - 30);
  return iso(d);
}

/**
 * Deposit due at signup. Monthly: balance split into equal monthly payments,
 * last one on the final payment date; fewer than 2 monthly slots → one balance
 * payment on the final date. Flexpay/Affirm: one balance item on the final date
 * (financed through the chosen provider).
 */
export function buildPaymentSchedule(
  total: number,
  deposit: number,
  departDate: string,
  signupDate: string,
  preference: PaymentPreference,
): ScheduledPayment[] {
  const today = signupDate.slice(0, 10);
  const out: ScheduledPayment[] = [];
  const depositCents = Math.round(deposit * 100);
  const balanceCents = Math.round(total * 100) - depositCents;
  if (depositCents > 0) out.push({ payment_type: "deposit", amount: depositCents / 100, due_date: today });
  if (balanceCents <= 0) return out;

  let final = finalPaymentDate(departDate);
  if (final < today) final = today;

  const start = parse(today);
  const finalD = parse(final);
  let months = 0;
  while (addMonths(start, months + 1) <= finalD) months++;

  if (preference !== "monthly" || months < 2) {
    out.push({ payment_type: "final_balance", amount: balanceCents / 100, due_date: final });
    return out;
  }

  const each = Math.floor(balanceCents / months);
  for (let k = 1; k <= months; k++) {
    const isLast = k === months;
    out.push({
      payment_type: isLast ? "final_balance" : "installment",
      amount: (isLast ? balanceCents - each * (months - 1) : each) / 100,
      due_date: isLast ? final : iso(addMonths(start, k)),
    });
  }
  return out;
}
