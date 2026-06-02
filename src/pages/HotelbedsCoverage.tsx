import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type DestRow = { destination_code: string; destination_name: string | null; hotel_count: number };
type SyncRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  hotels_processed: number;
  hotels_upserted: number;
  pages_fetched: number;
  error: string | null;
  triggered_by: string | null;
};

export default function HotelbedsCoverage() {
  const [rows, setRows] = useState<DestRow[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: hotels }, { count }, { data: runRows }] = await Promise.all([
      supabase
        .from("hotelbeds_hotels")
        .select("destination_code,destination_name")
        .limit(50000),
      supabase.from("hotelbeds_hotels").select("*", { count: "exact", head: true }),
      supabase
        .from("hotelbeds_sync_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10),
    ]);

    const agg = new Map<string, DestRow>();
    for (const h of hotels || []) {
      const code = h.destination_code || "—";
      const existing = agg.get(code);
      if (existing) existing.hotel_count += 1;
      else
        agg.set(code, {
          destination_code: code,
          destination_name: h.destination_name,
          hotel_count: 1,
        });
    }
    setRows([...agg.values()].sort((a, b) => b.hotel_count - a.hotel_count));
    setTotal(count || 0);
    setRuns((runRows as SyncRun[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function syncNow() {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("hotelbeds-content-sync", {
        body: { pageSize: 1000, maxPages: 50 },
      });
      if (error) throw error;
      toast.success("Sync started — refresh in a minute");
      setTimeout(load, 3000);
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const filtered = rows.filter(
    (r) =>
      !filter ||
      r.destination_code.toLowerCase().includes(filter.toLowerCase()) ||
      (r.destination_name || "").toLowerCase().includes(filter.toLowerCase()),
  );
  const lastRun = runs[0];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hotelbeds Mapping Coverage</h1>
          <p className="text-sm text-muted-foreground">
            Local Content API cache — required for certification
          </p>
        </div>
        <Button onClick={syncNow} disabled={syncing}>
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync Now
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cached hotels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{total.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Destinations covered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{rows.length.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastRun ? (
              <>
                <p className="text-lg font-semibold">
                  {formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true })}
                </p>
                <Badge
                  variant={lastRun.status === "success" ? "default" : "destructive"}
                  className="mt-1"
                >
                  {lastRun.status}
                </Badge>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Never</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Hotels upserted (last run)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {lastRun?.hotels_upserted?.toLocaleString() ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coverage by destination</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Filter by destination code or name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mb-4 max-w-sm"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destination code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Hotels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map((r) => (
                  <TableRow key={r.destination_code}>
                    <TableCell className="font-mono">{r.destination_code}</TableCell>
                    <TableCell>{r.destination_name || "—"}</TableCell>
                    <TableCell className="text-right">
                      {r.hotel_count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filtered.length > 200 && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing top 200 of {filtered.length.toLocaleString()} destinations
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sync runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right">Upserted</TableHead>
                <TableHead className="text-right">Pages</TableHead>
                <TableHead>Trigger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {formatDistanceToNow(new Date(r.started_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "success" ? "default" : "destructive"}>
                      {r.status}
                    </Badge>
                    {r.error && (
                      <p className="text-xs text-destructive mt-1 max-w-xs truncate">
                        {r.error}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.hotels_processed.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.hotels_upserted.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">{r.pages_fetched}</TableCell>
                  <TableCell className="text-xs">{r.triggered_by || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}