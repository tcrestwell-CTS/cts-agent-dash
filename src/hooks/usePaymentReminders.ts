import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PaymentReminderRow = {
  id: string;
  trip_id: string;
  user_id: string;
  amount: number;
  due_date: string | null;
  payment_type: string | null;
  status: string;
  details: string | null;
  trips: {
    trip_name: string | null;
    destination: string | null;
    client_id: string | null;
    clients: { id: string; name: string | null; email: string | null } | null;
  } | null;
  last_sent_at?: string | null;
  last_sent_to?: string | null;
};

export function usePaymentReminders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["payment-reminders", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_payments")
        .select(
          "id, trip_id, user_id, amount, due_date, payment_type, status, details, trips!inner(status, trip_name, destination, client_id, clients!trips_client_id_fkey(id, name, email))"
        )
        .neq("status", "paid")
        .neq("status", "cancelled")
        .neq("trips.status", "cancelled")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(500);
      if (error) throw error;
      const rows = (data || []) as unknown as PaymentReminderRow[];

      const tripIds = Array.from(new Set(rows.map((r) => r.trip_id))).filter(Boolean);
      if (tripIds.length === 0) return rows;

      const { data: logs } = await supabase
        .from("invoice_email_log")
        .select("trip_id, recipient_email, sent_at, meta")
        .in("trip_id", tripIds)
        .order("sent_at", { ascending: false })
        .limit(1000);

      const lastByTrip = new Map<string, { sent_at: string; recipient_email: string; trip_payment_id?: string | null }>();
      const lastByTripPayment = new Map<string, { sent_at: string; recipient_email: string }>();
      for (const l of (logs || []) as any[]) {
        const tpId = l.meta?.trip_payment_id as string | undefined;
        if (tpId && !lastByTripPayment.has(tpId)) {
          lastByTripPayment.set(tpId, { sent_at: l.sent_at, recipient_email: l.recipient_email });
        }
        if (l.trip_id && !lastByTrip.has(l.trip_id)) {
          lastByTrip.set(l.trip_id, { sent_at: l.sent_at, recipient_email: l.recipient_email });
        }
      }

      return rows.map((r) => {
        const exact = lastByTripPayment.get(r.id);
        const fallback = lastByTrip.get(r.trip_id);
        const pick = exact || fallback;
        return {
          ...r,
          last_sent_at: pick?.sent_at || null,
          last_sent_to: pick?.recipient_email || null,
        };
      });
    },
  });
}

export function useSendPaymentReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      trip_payment_id: string;
      custom_subject?: string;
      custom_message?: string;
      preview?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-payment-reminder", {
        body: input,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { ok: boolean; sent?: boolean; preview?: boolean; subject: string; html?: string; recipient: string; sent_at?: string; resend_id?: string };
    },
    onSuccess: (data) => {
      if (data?.sent) {
        qc.invalidateQueries({ queryKey: ["payment-reminders"] });
      }
    },
  });
}