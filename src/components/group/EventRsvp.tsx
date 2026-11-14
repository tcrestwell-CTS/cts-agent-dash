import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function EventRsvpForm({ token, sectionId, accentColor }: { token: string; sectionId: string; accentColor?: string }) {
  const [total, setTotal] = useState<number | null>(null);
  const [attending, setAttending] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [party, setParty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.rpc("get_event_rsvp_total", { p_token: token, p_section_id: sectionId }).then(({ data }) => {
      if (typeof data === "number") setTotal(data);
    });
  }, [token, sectionId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attending === null) return toast.error("Please choose whether you will attend.");
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_event_rsvp", {
      p_token: token, p_section_id: sectionId, p_name: name, p_email: email,
      p_attending: attending, p_party_size: attending ? party : 0,
    });
    setBusy(false);
    if (error) return toast.error(error.message || "Could not save your RSVP.");
    setTotal(data as number);
    setDone(true);
    toast.success("Thank you, your RSVP is saved.");
  };

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 not-italic whitespace-normal">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-semibold text-gray-900">RSVP</h4>
        {total !== null && <span className="text-sm text-gray-600">{total} {total === 1 ? "guest" : "guests"} attending so far</span>}
      </div>
      {done ? (
        <p className="text-sm text-gray-700">
          {attending ? `You're confirmed for ${party} ${party === 1 ? "person" : "people"}.` : "Thanks for letting us know you can't make it."} Submit again with the same email to change your answer.
          <button type="button" className="ml-2 underline" onClick={() => setDone(false)}>Change</button>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Will you attend?</legend>
            {[{ v: true, l: "Yes, I'll attend" }, { v: false, l: "No, I can't make it" }].map((o) => (
              <Button key={o.l} type="button" variant={attending === o.v ? "default" : "outline"} aria-pressed={attending === o.v}
                style={attending === o.v && accentColor ? { backgroundColor: accentColor, color: "white" } : undefined}
                onClick={() => setAttending(o.v)}>{o.l}</Button>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor={`rsvp-name-${sectionId}`}>Name</Label>
              <Input id={`rsvp-name-${sectionId}`} autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label htmlFor={`rsvp-email-${sectionId}`}>Email</Label>
              <Input id={`rsvp-email-${sectionId}`} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          {attending && (
            <div className="max-w-[12rem]"><Label htmlFor={`rsvp-party-${sectionId}`}>People in your party (incl. you)</Label>
              <Input id={`rsvp-party-${sectionId}`} type="number" min={1} max={20} required value={party}
                onChange={(e) => setParty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} /></div>
          )}
          <Button type="submit" disabled={busy} style={accentColor ? { backgroundColor: accentColor, color: "white" } : undefined}>
            {busy ? "Saving..." : "Submit RSVP"}
          </Button>
        </form>
      )}
    </div>
  );
}

export function EventRsvpList({ tripId, sectionId }: { tripId: string; sectionId: string }) {
  const [rows, setRows] = useState<{ id: string; name: string; email: string; attending: boolean; party_size: number }[]>([]);
  useEffect(() => {
    supabase.from("event_rsvps").select("id,name,email,attending,party_size").eq("trip_id", tripId).eq("section_id", sectionId)
      .order("created_at").then(({ data }) => setRows(data || []));
  }, [tripId, sectionId]);
  const yes = rows.filter((r) => r.attending);
  const heads = yes.reduce((s, r) => s + r.party_size, 0);
  return (
    <div className="rounded-md border p-3 text-sm space-y-2">
      <p className="font-medium">Headcount: {heads} attending · {yes.length} parties · {rows.length - yes.length} declined</p>
      {rows.length === 0 ? <p className="text-muted-foreground">No RSVPs yet.</p> : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-2">
              <span>{r.name} <span className="text-muted-foreground">({r.email})</span></span>
              <span>{r.attending ? `${r.party_size} attending` : "Not attending"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
