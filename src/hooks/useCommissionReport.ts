import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, useIsOfficeAdmin } from "@/hooks/useAdmin";

export interface CommissionReportItem {
  id: string;
  user_id: string;
  booking_id: string;
  amount: number;
  rate: number;
  status: string;
  paid_date: string | null;
  created_at: string;
  expected_commission: number | null;
  holdback_amount: number | null;
  holdback_released: boolean | null;
  booking: {
    id: string;
    confirmation_number: string;
    booking_reference?: string;
    destination?: string;
    total_price: number;
    total_amount?: number;
    gross_sales: number;
    commission_revenue: number;
    supplier_id: string | null;
    trip_id: string | null;
    client?: { id: string; name: string } | null;
    supplier: { id: string; name: string } | null;
    trip: { id: string; status: string; destination: string | null; depart_date: string | null } | null;
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
      const { data: commissions, error: commError } = await supabase
        .from("commissions")
        .select(`
          *,
          booking:bookings(
            id,
            confirmation_number,
            total_price,
            gross_sales,
            commission_revenue,
            supplier_id,
            trip_id,
            supplier:suppliers(id, name),
            trip:trips(id, status, destination, depart_date)
          )
        `)
        .order("created_at", { ascending: false });

      if (commError) throw commError;

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name, commission_tier");

      if (profileError) throw profileError;

      const result: CommissionReportItem[] = (commissions || [])
        .map((comm: any) => {
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

      // Also surface EXPECTED commissions: bookings with commission_revenue > 0
      // that do not yet have a matching commissions record.
      const bookedIds = new Set(
        (commissions || []).map((c: any) => c.booking_id).filter(Boolean)
      );

      const { data: expectedBookings, error: bkError } = await supabase
        .from("bookings")
        .select(`
          id,
          user_id,
          confirmation_number,
          total_price,
          gross_sales,
          commission_revenue,
          commissionable_amount,
          supplier_id,
          trip_id,
          created_at,
          supplier:suppliers(id, name),
          trip:trips(id, status, destination, depart_date)
        `)
        .gt("commission_revenue", 0)
        .order("created_at", { ascending: false });

      if (bkError) throw bkError;

      const expected: CommissionReportItem[] = (expectedBookings || [])
        .filter((b: any) => !bookedIds.has(b.id))
        .map((b: any) => {
          const agent = profiles?.find((p) => p.user_id === b.user_id) || null;
          const commissionable = Number(b.commissionable_amount || b.gross_sales || 0);
          const revenue = Number(b.commission_revenue || 0);
          const rate = commissionable > 0 ? (revenue / commissionable) * 100 : 0;
          return {
            id: `expected-${b.id}`,
            user_id: b.user_id,
            booking_id: b.id,
            amount: revenue,
            rate,
            status: "expected",
            paid_date: null,
            created_at: b.created_at,
            expected_commission: revenue,
            holdback_amount: null,
            holdback_released: null,
            booking: {
              id: b.id,
              confirmation_number: b.confirmation_number,
              total_price: b.total_price,
              gross_sales: b.gross_sales,
              commission_revenue: b.commission_revenue,
              supplier_id: b.supplier_id,
              trip_id: b.trip_id,
              client: null,
              supplier: b.supplier,
              trip: b.trip,
            } as CommissionReportItem["booking"],
            agent: agent ? {
              user_id: agent.user_id,
              full_name: agent.full_name,
              commission_tier: agent.commission_tier,
            } : null,
          };
        });

      return [...result, ...expected].sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
    },
    enabled: !!user,
  });
}
