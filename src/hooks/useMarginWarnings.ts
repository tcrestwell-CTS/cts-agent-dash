import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MarginWarning {
  rule_id: string;
  rule_name: string;
  rule_type: string;
  required_value: number;
  actual_value: number;
  message: string;
}

/**
 * Client-side display-only check of margin rules against a booking's current values.
 * The canonical enforcement happens server-side in calculate_booking_margin() RPC.
 */
export function useMarginWarnings(
  bookingId: string | undefined,
  supplierId: string | null | undefined,
  grossSales: number,
  agencyGrossMargin: number | undefined
) {
  const { user } = useAuth();
  const marginPct = grossSales > 0 && agencyGrossMargin !== undefined
    ? (agencyGrossMargin / grossSales) * 100
    : null;

  return useQuery({
    queryKey: ["margin-warnings", bookingId, supplierId, marginPct?.toFixed(2)],
    queryFn: async (): Promise<MarginWarning[]> => {
      if (marginPct === null) return [];

      const { data: rules, error } = await (supabase as any)
        .from("agency_margin_rules")
        .select("id, name, rule_type, rule_value, supplier_id")
        .eq("is_active", true)
        .eq("rule_type", "min_margin_pct")
        .or(`supplier_id.is.null,supplier_id.eq.${supplierId ?? "00000000-0000-0000-0000-000000000000"}`);

      if (error || !rules) return [];

      // Pick the highest-priority applicable rule (supplier-specific first)
      const sorted = (rules as any[]).sort((a: any, b: any) => {
        if (a.supplier_id && !b.supplier_id) return -1;
        if (!a.supplier_id && b.supplier_id) return 1;
        return 0;
      });

      const warnings: MarginWarning[] = [];
      const checked = sorted.slice(0, 1); // only top rule, matching RPC logic

      for (const rule of checked) {
        if (marginPct < rule.rule_value) {
          warnings.push({
            rule_id: rule.id,
            rule_name: rule.name,
            rule_type: rule.rule_type,
            required_value: rule.rule_value,
            actual_value: Math.round(marginPct * 10) / 10,
            message: `Margin ${marginPct.toFixed(1)}% is below minimum ${rule.rule_value}% required by rule "${rule.name}"`,
          });
        }
      }

      return warnings;
    },
    enabled: !!user && !!bookingId && marginPct !== null,
    staleTime: 30_000,
  });
}
