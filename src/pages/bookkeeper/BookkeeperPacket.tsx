import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, AlertTriangle, FileDown, Loader2, FileText } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useLogBookkeeperAction } from "@/hooks/useBookkeeperAudit";
import { format } from "date-fns";
import { toast } from "sonner";

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
  const { data: isAdmin } = useIsAdmin();
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
        (supabase as any).from("qbo_connections").select("id, status").eq("status", "active").limit(1),
        supabase.from("trip_payments").select("id", { count: "exact", head: true })
          .eq("status", "paid").gte("payment_date", start).lte("payment_date", end),
        supabase.from("invoices").select("id", { count: "exact", head: true }).gt("amount_remaining", 0),
        supabase.from("bookings").select("id", { count: "exact", head: true })
          .neq("supplier_paid_status", "paid").in("status", ["confirmed", "completed"]),
        (supabase as any).from("unattributed_deposits").select("id", { count: "exact", head: true })
          .is("resolved_at", null),
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
      const ids = Array.from(new Set((data || []).map((p: any) => p.generated_by).filter(Boolean)));
      let map: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles").select("user_id, full_name").in("user_id", ids);
        map = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.full_name || "—"]));
      }
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
      .from("financial-packets").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Could not generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
    logAction("download_financial_packet", path);
  };

  const CheckRow = ({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) => (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : warn ? (
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      ) : (
        <X className="h-4 w-4 text-destructive" />
      )}
      <span className={ok ? "" : warn ? "text-amber-700" : "text-destructive"}>{label}</span>
    </div>
  );

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 max-w-6xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Packet</h1>
          <p className="text-muted-foreground">
            Generate and download monthly financial reports.
          </p>
        </div>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Generate New Packet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-3 items-center">
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border bg-muted/30 p-4 space-y-2">
                <div className="text-sm font-medium mb-2">Readiness Checklist</div>
                {readyLoading ? (
                  <div className="text-sm text-muted-foreground">Checking…</div>
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
                className="bg-[hsl(var(--primary))]"
              >
                {generate.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
                ) : (
                  <>Generate Financial Packet</>
                )}
              </Button>
              {!ready && !readyLoading && (
                <p className="text-sm text-muted-foreground">
                  Complete the readiness checks above before generating.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Previous Packets</CardTitle>
          </CardHeader>
          <CardContent>
            {packetsLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (packets?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground">No packets generated yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Generated by</TableHead>
                    <TableHead>Generated at</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packets!.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {MONTHS[p.period_month - 1]} {p.period_year}
                      </TableCell>
                      <TableCell>{p.generated_by_name}</TableCell>
                      <TableCell>
                        {p.created_at ? format(new Date(p.created_at), "MMM d, yyyy h:mm a") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          p.status === "ready" ? "default" :
                          p.status === "failed" ? "destructive" : "secondary"
                        }>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm" variant="outline"
                          disabled={p.status !== "ready" || !p.storage_path}
                          onClick={() => handleDownload(p.storage_path)}
                        >
                          <FileDown className="h-4 w-4 mr-1" /> PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}