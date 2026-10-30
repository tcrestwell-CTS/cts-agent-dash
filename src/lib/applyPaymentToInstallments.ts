import { supabase } from "@/integrations/supabase/client";
import { planInstallmentApplication } from "../../supabase/functions/_shared/qbo-payment-rules";

/**
 * Allocate a freshly-paid payment against the trip's pending installments.
 *
 * Behavior:
 *   - Considers any pending trip_payments row with a due_date as an installment.
 *   - Excludes the source payment itself.
 *   - Walks installments in order of due_date (oldest first).
 *   - Marks installments "applied" while remaining covers them, so the source
 *     receipt stays the only cash row, then reduces the next installment and stops.
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
  const remaining = Number(amount) || 0;
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
  // Covered installments are "applied", not a second paid receipt. The source
  // row keeps the full amount and is the only cash counted in the trip balance.
  const plan = planInstallmentApplication(installments, remaining, datePaid);

  for (const update of plan.updates) {
    const { id, ...patch } = update;
    const { error: upErr } = await supabase.from("trip_payments").update(patch).eq("id", id);
    if (upErr) {
      console.error("applyPaymentToInstallments: failed to apply", upErr);
      break;
    }
  }

  return { markedPaid: plan.markedPaid, reducedRemainder: plan.reducedRemainder };
}