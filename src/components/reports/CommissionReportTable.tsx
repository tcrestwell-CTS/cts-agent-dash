import { CommissionReportItem } from "@/hooks/useCommissionReport";
import { calculateAgentCommission, getTierConfig, CommissionTier } from "@/lib/commissionTiers";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { ExternalLink, CheckCircle2, Clock, Hourglass } from "lucide-react";

interface CommissionReportTableProps {
  data: CommissionReportItem[];
  showAgentColumn: boolean;
}

export function CommissionReportTable({ data, showAgentColumn }: CommissionReportTableProps) {
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
    "Supplier", "Gross Sales", "Commission", "Agent Share", "Status"];
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
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
