// ═══════════════════════════════════════════════════════════════

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelBody } from "@/components/patterns/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Search, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useExceptions, useResolveException, ExceptionQueueItem, ExceptionStatus } from "@/hooks/useRecon";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const EXCEPTION_LABELS: Record<string, { label: string; color: string }> = {
  missing_qbo_invoice:        { label: "Missing Invoice",      color: "bg-red-100 text-red-800 border-red-200" },
  missing_qbo_payment:        { label: "Missing Payment",      color: "bg-orange-100 text-orange-800 border-orange-200" },
  missing_qbo_bill:           { label: "Missing Bill",         color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  missing_qbo_billpayment:    { label: "Missing Bill Payment", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  unmatched_stripe_payment:   { label: "Unmatched Stripe",     color: "bg-purple-100 text-purple-800 border-purple-200" },
  stripe_dispute:             { label: "Dispute",              color: "bg-red-100 text-red-800 border-red-200" },
  stripe_refund:              { label: "Refund",               color: "bg-blue-100 text-blue-800 border-blue-200" },
  failed_payout:              { label: "Failed Payout",        color: "bg-red-100 text-red-800 border-red-200" },
  amount_mismatch:            { label: "Amount Mismatch",      color: "bg-orange-100 text-orange-800 border-orange-200" },
  duplicate_payment:          { label: "Duplicate",            color: "bg-pink-100 text-pink-800 border-pink-200" },
  closed_period_conflict:     { label: "Closed Period",        color: "bg-gray-100 text-gray-800 border-gray-200" },
};

const STATUS_COLORS: Record<ExceptionStatus, string> = {
  open:      "bg-red-100 text-red-800 border-red-200",
  in_review: "bg-yellow-100 text-yellow-800 border-yellow-200",
  resolved:  "bg-green-100 text-green-800 border-green-200",
  archived:  "bg-gray-100 text-gray-800 border-gray-200",
};

export function ReconExceptions() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "open"
  );
  const [typeFilter, setTypeFilter] = useState<string>(
    searchParams.get("type") || "all"
  );
  const [search, setSearch] = useState("");
  const [resolving, setResolving] = useState<ExceptionQueueItem | null>(null);
  const [notes, setNotes] = useState("");

  const { data: exceptions, isLoading } = useExceptions(
    statusFilter !== "all" ? (statusFilter as ExceptionStatus) : undefined,
    typeFilter !== "all" ? typeFilter : undefined
  );

  const resolve = useResolveException();

  // Fetch trip names for any booking-related exceptions
  const bookingIds = useMemo(() => {
    if (!exceptions) return [];
    return Array.from(
      new Set(
        exceptions
          .filter((e) => e.source_record_type?.startsWith("booking") && e.source_record_id)
          .map((e) => e.source_record_id as string)
      )
    );
  }, [exceptions]);

  const { data: tripNameMap } = useQuery({
    queryKey: ["exception-trip-names", bookingIds],
    enabled: bookingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, trips(trip_name)")
        .in("id", bookingIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((b: any) => {
        if (b.trips?.trip_name) map[b.id] = b.trips.trip_name;
      });
      return map;
    },
  });

  const tripNameFor = (ex: ExceptionQueueItem) =>
    ex.source_record_id ? tripNameMap?.[ex.source_record_id] : undefined;

  const filtered = useMemo(() => {
    if (!exceptions) return [];
    if (!search) return exceptions;
    const q = search.toLowerCase();
    return exceptions.filter(
      (e) =>
        e.description?.toLowerCase().includes(q) ||
        e.exception_type.includes(q) ||
        e.source_record_id?.includes(q) ||
        (e.source_record_id && tripNameMap?.[e.source_record_id]?.toLowerCase().includes(q))
    );
  }, [exceptions, search, tripNameMap]);

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.025em] text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Exception Queue
          </h1>
          <p className="text-[13.5px] text-muted-foreground">
            Records that need manual review before QBO can be updated
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search exceptions..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Exception Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(EXCEPTION_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Panel>
          <PanelBody className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      {statusFilter === "open"
                        ? "No open exceptions — all clear!"
                        : "No exceptions found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((ex) => {
                    const typeCfg = EXCEPTION_LABELS[ex.exception_type] || {
                      label: ex.exception_type, color: "bg-gray-100 text-gray-800 border-gray-200",
                    };
                    return (
                      <TableRow key={ex.id}>
                        <TableCell>
                          <Badge className={`${typeCfg.color} text-xs`}>{typeCfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-xs">
                          <div className="truncate">{ex.description}</div>
                          {tripNameFor(ex) && (
                            <div className="text-xs text-muted-foreground truncate">
                              Trip: {tripNameFor(ex)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {ex.amount != null ? `$${ex.amount.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ex.source_system} / {ex.source_record_type}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_COLORS[ex.status]} text-xs`}>
                            {ex.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(ex.created_at), "MMM d")}
                        </TableCell>
                        <TableCell>
                          {ex.status === "open" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setResolving(ex); setNotes(""); }}
                            >
                              Resolve
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </PanelBody>
        </Panel>

        {/* Resolve Dialog */}
        <Dialog open={!!resolving} onOpenChange={(v) => !v && setResolving(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve Exception</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                {resolving?.description}
                {resolving && tripNameFor(resolving) && (
                  <span className="block mt-1">Trip: {tripNameFor(resolving)}</span>
                )}
              </p>
              <Textarea
                placeholder="Resolution notes (required)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolving(null)}>Cancel</Button>
              <Button
                disabled={!notes.trim() || resolve.isPending}
                onClick={async () => {
                  if (!resolving) return;
                  await resolve.mutateAsync({ id: resolving.id, notes });
                  setResolving(null);
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Resolved
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default ReconExceptions;


// ═══════════════════════════════════════════════════════════════
