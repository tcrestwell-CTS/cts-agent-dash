import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SyncState = "synced" | "failed" | "pending" | "not_eligible";

export interface PaymentSyncRow {
  id: string;
  trip_id: string | null;
  booking_id: string | null;
  amount: number;
  payment_date: string | null;
  status: string;
  payment_type: string | null;
  created_at: string;
  client_name: string | null;
  trip_name: string | null;
  qbo_payment_id: string | null;
  qbo_invoice_id: string | null;
  synced_at: string | null;
  sync_state: SyncState;
  last_error: string | null;
  last_log_at: string | null;
  log_history: Array<{
    id: string;
    sync_type: string;
    status: string;
    error_message: string | null;
    created_at: string;
    details: Record<string, unknown> | null;
  }>;
}

export function useQboPaymentSyncStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["qbo-payment-sync-status", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<PaymentSyncRow[]> => {
      const { data: payments, error: pErr } = await supabase
        .from("trip_payments")
        .select("id, trip_id, booking_id, amount, payment_date, status, payment_type, created_at, user_id")
        .eq("user_id", user!.id)
        .order("payment_date", { ascending: false, nullsFirst: false })
        .limit(500);
      if (pErr) throw pErr;

      const ids = (payments ?? []).map((p) => p.id);
      const tripIds = Array.from(new Set((payments ?? []).map((p) => p.trip_id).filter(Boolean) as string[]));

      const [{ data: qboPays }, { data: trips }, { data: logs }] = await Promise.all([
        ids.length
          ? supabase.from("qbo_payments").select("crm_payment_id, qbo_id, qbo_invoice_id, synced_at").in("crm_payment_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        tripIds.length
          ? supabase.from("trips").select("id, trip_name, status, client_id, clients:client_id(name)").in("id", tripIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("qbo_sync_logs")
          .select("id, sync_type, status, error_message, details, created_at")
          .ilike("sync_type", "%payment%")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);

      const qboMap = new Map<string, any>();
      (qboPays ?? []).forEach((q) => qboMap.set(q.crm_payment_id, q));

      const tripMap = new Map<string, any>();
      (trips ?? []).forEach((t: any) => tripMap.set(t.id, t));

      const logsByPayment = new Map<string, any[]>();
      (logs ?? []).forEach((l: any) => {
        const pid = l.details?.payment_id || l.details?.crm_payment_id;
        if (!pid) return;
        const arr = logsByPayment.get(pid) ?? [];
        arr.push(l);
        logsByPayment.set(pid, arr);
      });

      // Exclude payments tied to cancelled trips from the sync list entirely.
      const visible = (payments ?? []).filter((p) => {
        if (!p.trip_id) return true;
        const t = tripMap.get(p.trip_id);
        return String(t?.status ?? "").toLowerCase() !== "cancelled";
      });

      return visible.map((p): PaymentSyncRow => {
        const qbo = qboMap.get(p.id);
        const trip = p.trip_id ? tripMap.get(p.trip_id) : null;
        const history = logsByPayment.get(p.id) ?? [];
        const lastLog = history[0];
        let sync_state: SyncState;
        if (qbo) sync_state = "synced";
        else if (p.status !== "paid") sync_state = "not_eligible";
        else if (lastLog?.status === "error") sync_state = "failed";
        else sync_state = "pending";

        return {
          id: p.id,
          trip_id: p.trip_id,
          booking_id: p.booking_id,
          amount: Number(p.amount),
          payment_date: p.payment_date,
          status: p.status,
          payment_type: p.payment_type,
          created_at: p.created_at,
          client_name: trip?.clients?.name ?? null,
          trip_name: trip?.trip_name ?? null,
          qbo_payment_id: qbo?.qbo_id ?? null,
          qbo_invoice_id: qbo?.qbo_invoice_id ?? null,
          synced_at: qbo?.synced_at ?? null,
          sync_state,
          last_error: lastLog?.status === "error" ? lastLog?.error_message ?? null : null,
          last_log_at: lastLog?.created_at ?? null,
          log_history: history,
        };
      });
    },
  });
}
