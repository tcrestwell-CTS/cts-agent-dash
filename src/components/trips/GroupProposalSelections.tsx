import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { money } from "@/lib/hawaiiProposal";
import { toast } from "sonner";

export function GroupProposalSelections({ tripId }: { tripId: string }) {
  const client = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);
  const { data: selections = [], isLoading } = useQuery({
    queryKey: ["group-proposal-selections", tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("group_proposal_selections").select("*").eq("trip_id", tripId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = async (id: string, status: string, confirmedTotal: string, advisorNotes: string) => {
    setSavingId(id);
    const parsed = confirmedTotal.trim() ? Number(confirmedTotal) : null;
    const { error } = await supabase.from("group_proposal_selections").update({ status, confirmed_total: Number.isFinite(parsed) ? parsed : null, advisor_notes: advisorNotes || null, reviewed_at: new Date().toISOString() }).eq("id", id);
    setSavingId(null);
    if (error) toast.error("Could not save the review");
    else { toast.success("Proposal review saved"); client.invalidateQueries({ queryKey: ["group-proposal-selections", tripId] }); }
  };

  if (isLoading) return <Card><CardContent className="py-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading proposal requests…</CardContent></Card>;

  return <Card>
    <CardHeader><CardTitle className="text-[13.5px] flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Hawaii proposal requests <Badge variant="secondary">{selections.length}</Badge></CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {selections.length === 0 ? <p className="text-sm text-muted-foreground">No traveler selections have been submitted yet.</p> : selections.map((selection) => <SelectionReview key={selection.id} selection={selection} saving={savingId === selection.id} onSave={save} />)}
    </CardContent>
  </Card>;
}

function SelectionReview({ selection, saving, onSave }: { selection: any; saving: boolean; onSave: (id: string, status: string, total: string, notes: string) => void }) {
  const [status, setStatus] = useState(selection.status);
  const [total, setTotal] = useState(selection.confirmed_total?.toString() || "");
  const [notes, setNotes] = useState(selection.advisor_notes || "");
  return <article className="border border-border rounded-md p-4">
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h3 className="font-semibold">{selection.traveler_name}{selection.second_traveler_name ? ` & ${selection.second_traveler_name}` : ""}</h3><p className="text-xs text-muted-foreground mt-1">{selection.email}{selection.phone ? ` · ${selection.phone}` : ""} · {selection.party_size} traveler{selection.party_size === 1 ? "" : "s"}</p></div><Badge variant={status === "confirmed" ? "default" : "secondary"}>{status.replaceAll("_", " ")}</Badge></div>
    <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm"><div><p className="text-xs text-muted-foreground">Sailing</p><p className="font-medium">{selection.sailing_label}</p></div><div><p className="text-xs text-muted-foreground">Cabin</p><p className="font-medium">{selection.cabin_category}</p></div><div><p className="text-xs text-muted-foreground">Hotel</p><p className="font-medium">{selection.hotel_name}<br />{selection.hotel_room_type}</p></div></div>
    <div className="grid sm:grid-cols-3 gap-3 mt-4 p-3 bg-muted rounded-md text-sm"><div><p className="text-xs text-muted-foreground">Original known-cost quote</p><p className="font-semibold tabular-nums">{money(Number(selection.quoted_total))}</p></div><div><p className="text-xs text-muted-foreground">Free at Sea</p><p>{selection.free_at_sea_selection.replaceAll("_", " ")}</p></div><div><p className="text-xs text-muted-foreground">Excursions</p><p>{selection.excursions_selection.replaceAll("_", " ")}</p></div></div>
    {(selection.special_requests || selection.accessibility_requirements || selection.additional_comments) && <div className="mt-4 text-sm space-y-1"><p className="font-medium">Traveler notes</p>{selection.special_requests && <p>Special requests: {selection.special_requests}</p>}{selection.accessibility_requirements && <p>Accessibility: {selection.accessibility_requirements}</p>}{selection.additional_comments && <p>Comments: {selection.additional_comments}</p>}</div>}
    <div className="grid sm:grid-cols-[180px_180px_1fr_auto] gap-3 mt-4 items-end"><div><Label>Status</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="advisor_review">Advisor review</option><option value="contacted">Contacted</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option><option value="expired">Expired</option></select></div><div><Label>Confirmed total</Label><Input className="mt-1" type="number" min="0" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} placeholder="Enter final total" /></div><div><Label>Advisor notes</Label><Textarea className="mt-1 min-h-10" rows={1} value={notes} onChange={(event) => setNotes(event.target.value)} /></div><Button disabled={saving} onClick={() => onSave(selection.id, status, total, notes)}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save review"}</Button></div>
  </article>;
}