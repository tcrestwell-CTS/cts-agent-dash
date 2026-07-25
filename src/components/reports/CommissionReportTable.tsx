import { CommissionReportItem } from "@/hooks/useCommissionReport";
import { calculateAgentCommission, getTierConfig, CommissionTier } from "@/lib/commissionTiers";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { ExternalLink, CheckCircle2, Clock, Hourglass } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface CommissionReportTableProps {
  data: CommissionReportItem[];
  showAgentColumn: boolean;
}

export function CommissionReportTable({ data, showAgentColumn }: CommissionReportTableProps) {
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const markReceived = async (item: CommissionReportItem, receivedDate: string) => {
    setSavingId(item.id);
    try {
      if (item.status === "expected") {
        // No commissions row yet — create one as paid.
        const { error } = await supabase.from("commissions").insert({
          booking_id: item.booking_id,
          user_id: item.user_id,
          amount: item.amount,
          rate: item.rate,
          status: "paid",
          paid_date: receivedDate,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("commissions")
          .update({ status: "paid", paid_date: receivedDate })
          .eq("id", item.id);
        if (error) throw error;
      }
      toast.success("Marked as received");
      queryClient.invalidateQueries({ queryKey: ["commission-report"] });
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
    } catch (e: any) {
      toast.error("Failed to update: " + e.message);
    } finally {
      setSavingId(null);
    }
  };

  const unmarkReceived = async (item: CommissionReportItem) => {
    setSavingId(item.id);
    try {
      const { error } = await supabase
        .from("commissions")
        .update({ status: "pending", paid_date: null })
        .eq("id", item.id);
      if (error) throw error;
      toast.success("Marked as pending");
      queryClient.invalidateQueries({ queryKey: ["commission-report"] });
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
    } catch (e: any) {
      toast.error("Failed to update: " + e.message);
    } finally {
      setSavingId(null);
    }
  };

  const updateReceivedDate = async (item: CommissionReportItem, newDate: string) => {
    if (!newDate) return;
    setSavingId(item.id);
    try {
      const { error } = await supabase
        .from("commissions")
        .update({ paid_date: newDate })
        .eq("id", item.id);
      if (error) throw error;
      toast.success("Date updated");
      queryClient.invalidateQueries({ queryKey: ["commission-report"] });
    } catch (e: any) {
      toast.error("Failed to update date: " + e.message);
    } finally {
      setSavingId(null);
    }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No commissions match your filters</p>
      </div>
    );
  }

  const headers = ["Date", "Booking", "Client",
    ...(showAgentColumn ? ["Agent"] : []),
    "Supplier", "Gross Sales", "Commission", "Agent Share", "Status", "Received"];
  const rightAlignFrom = showAgentColumn ? 5 : 4;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {headers.map((h, i) => (
              <th key={h} className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${i >= rightAlignFrom ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((item, idx) => {
            const tier = (item.agent?.commission_tier || "tier_1") as CommissionTier;
            const agentShare = calculateAgentCommission(item.amount, tier);
            const tierConfig = getTierConfig(tier);
            const isPaid = item.status === "paid";
            const isExpected = item.status === "expected";
            return (
              <tr key={item.id} className={`hover:bg-muted/30 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                <td className="px-5 py-3 text-muted-foreground whitespace-nowrap text-xs">
                  {format(parseISO(item.created_at), "MMM d, yyyy")}
                </td>
                <td className="px-5 py-3">
                  <Link to={`/bookings/${item.booking_id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    {item.booking?.booking_reference || item.booking?.confirmation_number || item.booking_id?.slice(0, 8)}
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  </Link>
                  {item.booking?.destination && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[150px]">{item.booking.destination}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-sm">{item.booking?.client?.name || "—"}</td>
                {showAgentColumn && (
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium">{item.agent?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{tierConfig.label}</p>
                  </td>
                )}
                <td className="px-5 py-3 text-sm text-muted-foreground">{item.booking?.supplier?.name || "—"}</td>
                <td className="px-5 py-3 text-right tabular-nums font-medium">{fmt(item.booking?.gross_sales || item.booking?.total_amount || 0)}</td>
                <td className="px-5 py-3 text-right tabular-nums font-semibold text-primary">{fmt(item.amount)}</td>
                <td className="px-5 py-3 text-right tabular-nums font-semibold text-green-600">{fmt(agentShare)}</td>
                <td className="px-5 py-3 text-right">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    isPaid ? "bg-green-50 text-green-700 border-green-200"
                    : isExpected ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>
                    {isPaid ? <><CheckCircle2 className="h-3 w-3" />Paid</>
                     : isExpected ? <><Hourglass className="h-3 w-3" />Expected</>
                     : <><Clock className="h-3 w-3" />Pending</>}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex items-center gap-2 justify-end">
                    <Checkbox
                      checked={isPaid}
                      disabled={savingId === item.id}
                      onCheckedChange={(checked) => {
                        if (checked) markReceived(item, item.paid_date || todayISO());
                        else unmarkReceived(item);
                      }}
                      aria-label="Mark commission received"
                    />
                    {isPaid ? (
                      <Input
                        type="date"
                        value={item.paid_date ? item.paid_date.slice(0, 10) : ""}
                        disabled={savingId === item.id}
                        onChange={(e) => updateReceivedDate(item, e.target.value)}
                        className="h-7 w-[140px] text-xs"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground w-[140px] inline-block">—</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/20">
            <td colSpan={rightAlignFrom} className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Totals ({data.length} records)
            </td>
            <td className="px-5 py-3 text-right tabular-nums font-bold">{fmt(data.reduce((s,i) => s+(i.booking?.gross_sales||i.booking?.total_amount||0),0))}</td>
            <td className="px-5 py-3 text-right tabular-nums font-bold text-primary">{fmt(data.reduce((s,i)=>s+i.amount,0))}</td>
            <td className="px-5 py-3 text-right tabular-nums font-bold text-green-600">{fmt(data.reduce((s,i)=>s+calculateAgentCommission(i.amount,(i.agent?.commission_tier||"tier_1")as CommissionTier),0))}</td>
            <td className="px-5 py-3"/>
            <td className="px-5 py-3"/>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
