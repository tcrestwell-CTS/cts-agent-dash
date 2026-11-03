import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, AlertTriangle, FileDown, Loader2, FileText } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfileMap } from "@/lib/bookkeeperLookups";
import { usePermissions } from "@/hooks/usePermissions";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { format } from "date-fns";
import { toast } from "sonner";
import { BookkeeperBreadcrumb, EmptyState } from "@/components/bookkeeper/shared";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { SemanticStatusPill } from "@/components/patterns/StatusPill";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function periodBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export default function BookkeeperPacket() {
  const { isAdmin, isOfficeAdmin, isBookkeeper } = usePermissions();
  const canGenerate = isAdmin || isOfficeAdmin || isBookkeeper;
  const qc = useQueryClient();
  const logAction = useLogBookkeeperAction();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // current month
  const { start, end } = useMemo(() => periodBounds(year, month), [year, month]);

  // Readiness checks
  const { data: readiness, isLoading: readyLoading } = useQuery({
    queryKey: ["packet-readiness", year, month],
    queryFn: async () => {
      const [qboRes, pmtRes, arRes, apRes, unattrRes] = await Promise.all([
        supabase.from("qbo_connections").select("id, is_active").eq("is_active", true).limit(1),
        supabase.from("trip_payments").select("id", { count: "exact", head: true })
          .eq("status", "paid").gte("payment_date", start).lte("payment_date", end),
        supabase.from("invoices").select("id", { count: "exact", head: true }).gt("amount_remaining", 0),
        supabase.from("bookings").select("id", { count: "exact", head: true })
          .neq("supplier_paid_status", "paid").in("status", ["confirmed", "completed"]),
        (supabase as any).from("checkout_payments").select("id", { count: "exact", head: true })
          .eq("payment_type", "unattributed_deposit")
          .eq("status", "succeeded").is("trip_id", null),
      ]);
      return {
        qbo: !!(qboRes.data && qboRes.data.length > 0),
        hasTxns: (pmtRes.count ?? 0) > 0,
        arReady: (arRes.count ?? 0) >= 0,
        apReady: (apRes.count ?? 0) >= 0,
        unattributed: unattrRes.count ?? 0,
      };
    },
  });

  const { data: packets, isLoading: packetsLoading } = useQuery({
    queryKey: ["financial-packets-list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("financial_packets")
        .select("id, period_year, period_month, generated_by, created_at, status, storage_path")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = Array.from(
        new Set((data || []).map((p: any) => p.generated_by).filter(Boolean) as string[]),
      ) as string[];
      const profMap = await fetchProfileMap(ids);
      const map: Record<string, string> = Object.fromEntries(
        Object.values(profMap).map((p) => [p.user_id, p.full_name || "—"]),
      );
      return (data || []).map((p: any) => ({ ...p, generated_by_name: map[p.generated_by] || "—" }));
    },
  });

  const ready = !!readiness && readiness.qbo && readiness.hasTxns;

  const generate = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // Insert placeholder row first
      const { data: row, error: insErr } = await (supabase as any)
        .from("financial_packets")
        .insert({ period_year: year, period_month: month, generated_by: session?.user?.id, status: "generating" })
        .select("id").single();
      if (insErr) throw insErr;

      const { data, error } = await supabase.functions.invoke("generate-financial-packet", {
        body: { period_year: year, period_month: month, packet_id: row.id },
      });
      if (error) throw error;
      logAction("generate_financial_packet", `${year}-${month}`, { packet_id: row.id });
      return data;
    },
    onSuccess: () => {
      toast.success("Financial packet generated");
      qc.invalidateQueries({ queryKey: ["financial-packets-list"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to generate packet"),
  });

  const handleDownload = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("financial-packets").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Could not generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
    logAction("download_financial_packet", path);
  };

  const CheckRow = ({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) => (
    <div className="flex items-center gap-2 text-[13.5px]">
      {ok ? (
        <Check className="h-4 w-4 text-success" />
      ) : warn ? (
        <AlertTriangle className="h-4 w-4 text-warning" />
      ) : (
        <X className="h-4 w-4 text-destructive" />
      )}
      <span className={ok ? "text-foreground" : warn ? "text-warning" : "text-destructive"}>{label}</span>
    </div>
  );

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  return (
    <DashboardLayout>
      <div className="max-w-6xl space-y-[18px]">
        <div className="space-y-1">
          <BookkeeperBreadcrumb page="Financial Packet" />
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Financial Packet</h1>
          <p className="text-[13.5px] text-muted-foreground">
            Generate and download monthly financial reports.
          </p>
        </div>

        {canGenerate && (
          <Panel>
            <PanelHeader title={<span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Generate New Packet</span>} />
            <PanelBody className="space-y-[14px]">
              <div className="flex flex-wrap items-center gap-3">
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="w-[180px] text-[13.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-[120px] text-[13.5px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 rounded-[9px] border border-border bg-card-2 p-[14px]">
                <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Readiness Checklist</div>
                {readyLoading ? (
                  <div className="text-[13px] text-muted-foreground">Checking…</div>
                ) : (
                  <>
                    <CheckRow ok={!!readiness?.qbo} label="QuickBooks Online connected" />
                    <CheckRow ok={!!readiness?.hasTxns} label="Period has client payments" />
                    <CheckRow ok={!!readiness?.arReady} label="AR aging data available" />
                    <CheckRow ok={!!readiness?.apReady} label="AP aging data available" />
                    <CheckRow
                      ok={(readiness?.unattributed ?? 0) === 0}
                      warn={(readiness?.unattributed ?? 0) > 0}
                      label={
                        (readiness?.unattributed ?? 0) > 0
                          ? `${readiness?.unattributed} unattributed deposit(s) — review before generating`
                          : "No unattributed deposits"
                      }
                    />
                  </>
                )}
              </div>

              <Button
                onClick={() => generate.mutate()}
                disabled={!ready || generate.isPending}
                className="text-[13px]"
              >
                {generate.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
                ) : (
                  <>Generate Financial Packet</>
                )}
              </Button>
              {!ready && !readyLoading && (
                <p className="text-[12.5px] text-muted-foreground">
                  Complete the readiness checks above before generating.
                </p>
              )}
            </PanelBody>
          </Panel>
        )}

        <Panel>
          <PanelHeader title="Previous Packets" />
          <PanelBody>
            {packetsLoading ? (
              <div className="text-[13px] text-muted-foreground">Loading…</div>
            ) : (packets?.length ?? 0) === 0 ? (
              <EmptyState title="No packets yet" description="Generated financial packets will appear here." />
            ) : (
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Generated by</th>
                    <th>Generated at</th>
                    <th>Status</th>
                    <th className="text-right">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {packets!.map((p: any) => (
                    <tr key={p.id}>
                      <td className="font-medium">
                        {MONTHS[p.period_month - 1]} {p.period_year}
                      </td>
                      <td><span className="data-table-secondary">{p.generated_by_name}</span></td>
                      <td>
                        <span className="data-table-secondary">
                          {p.created_at ? format(new Date(p.created_at), "MMM d, yyyy h:mm a") : "—"}
                        </span>
                      </td>
                      <td>
                        <SemanticStatusPill
                          status={p.status === "ready" ? "success" : p.status === "failed" ? "destructive" : "info"}
                          label={p.status}
                        />
                      </td>
                      <td className="text-right">
                        <Button
                          size="sm" variant="outline"
                          disabled={p.status !== "ready" || !p.storage_path}
                          onClick={() => handleDownload(p.storage_path)}
                          className="text-[13px]"
                        >
                          <FileDown className="h-4 w-4 mr-1" /> PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </PanelBody>
        </Panel>
      </div>
    </DashboardLayout>
  );
}