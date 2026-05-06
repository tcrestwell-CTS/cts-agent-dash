import { supabase } from "@/integrations/supabase/client";

/**
 * Allocate a freshly-paid payment against the trip's pending installments.
 *
 * Behavior:
 *   - Considers any pending trip_payments row with a due_date as an installment.
 *   - Excludes the source payment itself.
 *   - Walks installments in order of due_date (oldest first).
 *   - Marks installments fully paid while remaining covers them, then reduces
 *     the next installment's amount by whatever is left and stops.
 *   - Does nothing if the source payment has no remaining amount or no
 *     pending installments exist.
 */
export async function applyPaymentToInstallments(params: {
  tripId: string;
  sourcePaymentId: string;
  amount: number;
  paymentDate?: string | null;
}): Promise<{ markedPaid: number; reducedRemainder: number }> {
  const { tripId, sourcePaymentId, amount, paymentDate } = params;
  let remaining = Number(amount) || 0;
  if (remaining <= 0) return { markedPaid: 0, reducedRemainder: 0 };

  const { data: installments, error } = await supabase
    .from("trip_payments")
    .select("id, amount, due_date, status")
    .eq("trip_id", tripId)
    .eq("status", "pending")
    .not("due_date", "is", null)
    .neq("id", sourcePaymentId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("applyPaymentToInstallments: failed to load installments", error);
    return { markedPaid: 0, reducedRemainder: 0 };
  }
  if (!installments || installments.length === 0) {
    return { markedPaid: 0, reducedRemainder: 0 };
  }

  const datePaid = paymentDate || new Date().toISOString().split("T")[0];
  let markedPaid = 0;
  let reducedRemainder = 0;

  for (const inst of installments) {
    if (remaining <= 0.0049) break;
    const instAmt = Number(inst.amount) || 0;
    if (instAmt <= 0) continue;

    if (remaining + 0.0049 >= instAmt) {
      // Fully cover this installment.
      const { error: upErr } = await supabase
        .from("trip_payments")
        .update({ status: "paid", payment_date: datePaid })
        .eq("id", inst.id);
      if (upErr) {
        console.error("applyPaymentToInstallments: failed to mark paid", upErr);
        break;
      }
      remaining = Math.round((remaining - instAmt) * 100) / 100;
      markedPaid += 1;
    } else {
      // Partially reduce the next installment by the leftover, then stop.
      const newAmt = Math.round((instAmt - remaining) * 100) / 100;
      const { error: upErr } = await supabase
        .from("trip_payments")
        .update({ amount: newAmt })
        .eq("id", inst.id);
      if (upErr) {
        console.error("applyPaymentToInstallments: failed to reduce", upErr);
        break;
      }
      reducedRemainder = remaining;
      remaining = 0;
      break;
    }
  }

  return { markedPaid, reducedRemainder };
}