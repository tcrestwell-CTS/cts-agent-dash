import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PreviewPlan {
  parsed: { trips: number; bookings: number; tripRowsRaw: number; bookingRowsRaw: number };
  plan: {
    clients: { create: { name: string }[]; reuse: number };
    suppliers: { create: { name: string }[]; reuse: number };
    trips: { create: number; update: number; reuse: number };
    bookings: { create: number; duplicate: number };
    warnings: string[];
    unmatchedBookings: { confirmation_number: string; client_name: string; supplier_name: string; reason: string }[];
  };
}

interface CommitResult {
  parsed: { trips: number; bookings: number };
  result: {
    clientsCreated: number;
    suppliersCreated: number;
    tripsCreated: number;
    bookingsCreated: number;
    bookingsSkipped: number;
    errors: string[];
  };
}

export default function TernImport() {
  const { user } = useAuth();
  const [tripsCsv, setTripsCsv] = useState<string>("");
  const [bookingsCsv, setBookingsCsv] = useState<string>("");
  const [tripsFile, setTripsFile] = useState<string | null>(null);
  const [bookingsFile, setBookingsFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewPlan | null>(null);
  const [committed, setCommitted] = useState<CommitResult | null>(null);

  const readFile = (f: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result ?? ""));
      r.onerror = () => rej(new Error("Read failed"));
      r.readAsText(f);
    });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, kind: "trips" | "bookings") => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await readFile(f);
    if (kind === "trips") {
      setTripsCsv(text);
      setTripsFile(f.name);
    } else {
      setBookingsCsv(text);
      setBookingsFile(f.name);
    }
    setPreview(null);
    setCommitted(null);
  };

  const runPreview = async () => {
    if (!user) return;
    if (!tripsCsv && !bookingsCsv) {
      toast.error("Upload at least one Tern CSV file");
      return;
    }
    setLoading(true);
    setCommitted(null);
    try {
      const { data, error } = await supabase.functions.invoke("tern-import", {
        body: { mode: "preview", targetUserId: user.id, tripsCsv, bookingsCsv },
      });
      if (error) throw error;
      setPreview(data as PreviewPlan);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const runCommit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tern-import", {
        body: { mode: "commit", targetUserId: user.id, tripsCsv, bookingsCsv },
      });
      if (error) throw error;
      setCommitted(data as CommitResult);
      toast.success("Import completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTripsCsv("");
    setBookingsCsv("");
    setTripsFile(null);
    setBookingsFile(null);
    setPreview(null);
    setCommitted(null);
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import from Tern.travel</h1>
        <p className="text-muted-foreground mt-1">
          Upload your <span className="font-mono">All_Trips.csv</span> and{" "}
          <span className="font-mono">All_Bookings.csv</span> exports from Tern. We dedupe against existing
          contacts (by name), suppliers (by name), trips (by trip name), and bookings (by confirmation #).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Upload Tern exports</CardTitle>
          <CardDescription>
            From Tern: <strong>Agency Trips → Export</strong> and <strong>Commission → Bookings → Export</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Trips CSV
              </Label>
              <Input type="file" accept=".csv" onChange={(e) => handleFile(e, "trips")} />
              {tripsFile && (
                <p className="text-xs text-muted-foreground">
                  Loaded: <span className="font-mono">{tripsFile}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Bookings CSV
              </Label>
              <Input type="file" accept=".csv" onChange={(e) => handleFile(e, "bookings")} />
              {bookingsFile && (
                <p className="text-xs text-muted-foreground">
                  Loaded: <span className="font-mono">{bookingsFile}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={runPreview} disabled={loading || (!tripsCsv && !bookingsCsv)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Preview import
            </Button>
            <Button variant="outline" onClick={reset} disabled={loading}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && !committed && (
        <Card>
          <CardHeader>
            <CardTitle>2. Review the plan</CardTitle>
            <CardDescription>
              Parsed {preview.parsed.trips} trips and {preview.parsed.bookings} bookings from your file(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="New contacts" value={preview.plan.clients.create.length} accent="green" />
              <StatCard label="New suppliers" value={preview.plan.suppliers.create.length} accent="green" />
              <StatCard
                label="New trips"
                value={preview.plan.trips.create}
                sub={`${preview.plan.trips.reuse} already exist`}
                accent="green"
              />
              <StatCard
                label="New bookings"
                value={preview.plan.bookings.create}
                sub={`${preview.plan.bookings.duplicate} duplicate (skipped)`}
                accent="green"
              />
            </div>

            {preview.plan.clients.create.length > 0 && (
              <div>
                <Label className="text-sm">Contacts to be created ({preview.plan.clients.create.length})</Label>
                <div className="mt-1 flex flex-wrap gap-1 max-h-40 overflow-auto rounded border p-2">
                  {preview.plan.clients.create.slice(0, 100).map((c, i) => (
                    <Badge key={i} variant="secondary">{c.name}</Badge>
                  ))}
                  {preview.plan.clients.create.length > 100 && (
                    <Badge variant="outline">+{preview.plan.clients.create.length - 100} more</Badge>
                  )}
                </div>
              </div>
            )}

            {preview.plan.suppliers.create.length > 0 && (
              <div>
                <Label className="text-sm">Suppliers to be created ({preview.plan.suppliers.create.length})</Label>
                <div className="mt-1 flex flex-wrap gap-1 rounded border p-2">
                  {preview.plan.suppliers.create.map((s, i) => (
                    <Badge key={i} variant="secondary">{s.name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {preview.plan.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Warnings</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 text-sm">
                    {preview.plan.warnings.slice(0, 10).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>Back</Button>
              <Button onClick={runCommit} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Confirm & import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {committed && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Import complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard label="Contacts created" value={committed.result.clientsCreated} accent="green" />
              <StatCard label="Suppliers created" value={committed.result.suppliersCreated} accent="green" />
              <StatCard label="Trips created" value={committed.result.tripsCreated} accent="green" />
              <StatCard label="Bookings created" value={committed.result.bookingsCreated} accent="green" />
              <StatCard label="Bookings skipped" value={committed.result.bookingsSkipped} accent="muted" />
            </div>

            {committed.result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{committed.result.errors.length} error(s) during import</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 text-sm max-h-48 overflow-auto">
                    {committed.result.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={reset}>Import another file</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: "green" | "muted";
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${accent === "green" ? "text-green-600" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}