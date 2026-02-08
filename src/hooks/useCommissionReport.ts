import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, useIsOfficeAdmin } from "./useAdmin";

export interface CommissionReportItem {
  id: string;
  booking_id: string;
  user_id: string;
  amount: number;
  rate: number;
  status: string;
  paid_date: string | null;
  created_at: string;
  booking: {
    id: string;
    booking_reference: string;
    destination: string;
    total_amount: number;
    gross_sales: number;
    commission_revenue: number;
    depart_date: string;
    supplier_id: string | null;
    client: {
      id: string;
      name: string;
    } | null;
    supplier: {
      id: string;
      name: string;
    } | null;
  } | null;
  agent: {
    user_id: string;
    full_name: string | null;
    commission_tier: string | null;
  } | null;
}

export function useCommissionReport() {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: isOfficeAdmin } = useIsOfficeAdmin();

  const canViewAll = isAdmin || isOfficeAdmin;

  return useQuery({
    queryKey: ["commission-report", user?.id, canViewAll],
    queryFn: async () => {
      // Fetch commissions with booking, client, supplier, and agent info
      const { data: commissions, error: commError } = await supabase
        .from("commissions")
        .select(`
          *,
          booking:bookings(
            id,
            booking_reference,
            destination,
            total_amount,
            gross_sales,
            commission_revenue,
            depart_date,
            supplier_id,
            client:clients(id, name),
            supplier:suppliers(id, name)
          )
        `)
        .order("created_at", { ascending: false });

      if (commError) throw commError;

      // Fetch agent profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name, commission_tier");

      if (profileError) throw profileError;

      // Map profiles to commissions
      const result: CommissionReportItem[] = (commissions || []).map((comm) => {
        const agent = profiles?.find((p) => p.user_id === comm.user_id) || null;
        return {
          ...comm,
          booking: comm.booking as CommissionReportItem["booking"],
          agent: agent ? {
            user_id: agent.user_id,
            full_name: agent.full_name,
            commission_tier: agent.commission_tier,
          } : null,
        };
      });

      return result;
    },
    enabled: !!user,
  });
}

export function useAgentList() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["agent-list", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}
