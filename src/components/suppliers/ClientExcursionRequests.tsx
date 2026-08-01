import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExcursionRequest {
  id: string;
  client_id: string;
  trip_id: string | null;
  product_code: string;
  product_title: string | null;
  destination: string | null;
  product_url: string | null;
  image_url: string | null;
  travel_date: string | null;
  travelers: number;
  price_per_person: number | null;
  estimated_total: number | null;
  estimated_commission: number | null;
  client_notes: string | null;
  agent_notes: string | null;
  status: string;
  created_at: string;
  clients?: { name: string | null; email: string | null } | null;
  trips?: { trip_name: string | null } | null;
}

const STATUSES = ["requested", "confirmed", "booked", "declined", "cancelled"] as const;

export default function ClientExcursionRequests() {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["excursion-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursion_requests" as any)
        .select("*, clients(name, email), trips(trip_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as ExcursionRequest[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status, agentNotes }: { id: string; status?: string; agentNotes?: string }) => {
      const payload: Record<string, unknown> = {};
      if (status) payload.status = status;
      if (agentNotes !== undefined) payload.agent_notes = agentNotes || null;
      const { error } = await supabase
        .from("excursion_requests" as any)
        .update(payload as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["excursion-requests"] });
      toast.success("Request updated");
    },
    onError: (e: any) => toast.error(e?.message || "Could not update that request"),
  });

  const requests = data ?? [];

  if (isLoading) {
    return <p className="text-[13px] text-muted-foreground">Loading client requests…</p>;
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-8 text-center">
        <Ticket className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-[13.5px] font-medium text-foreground">No client requests yet</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Clients can browse and request excursions from the Excursions tab in their portal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-col gap-4 p-4 md:flex-row">
            {r.image_url && (
              <img src={r.image_url} alt={r.product_title ?? "Excursion"} loading="lazy"
                className="h-24 w-full rounded-md object-cover md:w-40" />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13.5px] font-semibold text-foreground">
                  {r.product_title || r.product_code}
                </p>
                <Badge variant={r.status === "requested" ? "secondary" : r.status === "declined" || r.status === "cancelled" ? "outline" : "default"}>
                  {r.status}
                </Badge>
                {r.product_url && (
                  <a href={r.product_url} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground" aria-label="Open on supplier site">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <p className="text-[12.5px] text-muted-foreground">
                {[
                  r.clients?.name,
                  r.trips?.trip_name,
                  r.destination,
                  r.travel_date,
                  `${r.travelers} pax`,
                ].filter(Boolean).join(" · ")}
              </p>
              <p className="text-[12.5px] tabular-nums text-muted-foreground">
                {r.estimated_total != null ? `Est. $${r.estimated_total.toFixed(2)}` : "Price TBD"}
                {r.estimated_commission != null ? ` · est. commission $${r.estimated_commission.toFixed(2)}` : ""}
              </p>
              {r.client_notes && (
                <p className="rounded-md bg-muted/60 p-2 text-[12.5px] text-foreground">“{r.client_notes}”</p>
              )}
              <Textarea
                rows={2}
                placeholder="Note back to the client (shown in their portal)…"
                value={notes[r.id] ?? r.agent_notes ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={update.isPending}
                  onClick={() => update.mutate({ id: r.id, agentNotes: notes[r.id] ?? r.agent_notes ?? "" })}>
                  {update.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Save note
                </Button>
                {STATUSES.filter((s) => s !== r.status).map((s) => (
                  <Button key={s} size="sm" variant="ghost" disabled={update.isPending}
                    onClick={() => update.mutate({ id: r.id, status: s, agentNotes: notes[r.id] ?? r.agent_notes ?? "" })}>
                    Mark {s}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}