import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Ship, Calendar, MapPin, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { WidgetySailing } from "./types";
import { formatShortDate } from "./utils";

interface RequestQuoteDialogProps {
  sailing: WidgetySailing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Quote-only cruise search: pricing is never shown on results. Requesting a
// quote drops the sailing into the quote_requests lead pipeline, where the
// generated proposal returns live, cabin-by-cabin pricing to the client.
export function RequestQuoteDialog({ sailing, open, onOpenChange }: RequestQuoteDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [cabin, setCabin] = useState("Any cabin");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setAdults("2");
    setChildren("0");
    setCabin("Any cabin");
    setNotes("");
  };

  const submit = async () => {
    if (!sailing) return;
    if (!firstName.trim() || !email.trim()) {
      toast.error("Client name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const sailingSummary = [
        `Cruise line: ${sailing.operator_title}`,
        sailing.ship_title ? `Ship: ${sailing.ship_title}` : null,
        `Sailing: ${sailing.name}`,
        sailing.date_from
          ? `Dates: ${formatShortDate(sailing.date_from)}${sailing.date_to ? ` – ${formatShortDate(sailing.date_to)}` : ""}`
          : null,
        sailing.nights ? `Length: ${sailing.nights} nights` : null,
        sailing.starts_at?.name ? `Departs from: ${sailing.starts_at.name}` : null,
        `Cabin preference: ${cabin}`,
        `Ref: ${sailing.holiday_ref}`,
      ]
        .filter(Boolean)
        .join("\n");

      const message = [
        "[Cruise search quote request — pricing hidden; include live cabin-by-cabin pricing in the quote]",
        sailingSummary,
        notes.trim() ? `\nClient notes: ${notes.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const { error } = await supabase.from("quote_requests").insert({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        trip_type: "cruise",
        destination: sailing.starts_at?.name || null,
        departure_date: sailing.date_from || null,
        travelers_adults: Number(adults) || 2,
        travelers_children: Number(children) || 0,
        message,
      });
      if (error) throw error;

      toast.success("Quote request created — it's in your Leads pipeline for a live-priced quote.");
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error("Quote request failed:", err);
      toast.error(
        "Couldn't create the quote request: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Exact Quote</DialogTitle>
        </DialogHeader>
        {sailing && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <p className="font-medium flex items-center gap-2">
              <Ship className="h-4 w-4 text-primary shrink-0" />
              {sailing.operator_title}
              {sailing.ship_title ? ` — ${sailing.ship_title}` : ""}
            </p>
            <p className="text-muted-foreground">{sailing.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {sailing.date_from ? formatShortDate(sailing.date_from) : "—"}
              {sailing.date_to ? ` – ${formatShortDate(sailing.date_to)}` : ""}
              {sailing.nights ? ` • ${sailing.nights} nights` : ""}
            </p>
            {sailing.starts_at?.name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {sailing.starts_at.name}
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          No pricing is shown here by design — the generated quote will include live, current
          fares for this sailing when it's returned to the client.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rq-first">First name *</Label>
            <Input id="rq-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rq-last">Last name</Label>
            <Input id="rq-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rq-email">Email *</Label>
            <Input
              id="rq-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rq-phone">Phone</Label>
            <Input id="rq-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rq-adults">Adults</Label>
            <Input
              id="rq-adults"
              type="number"
              min={1}
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rq-children">Children</Label>
            <Input
              id="rq-children"
              type="number"
              min={0}
              value={children}
              onChange={(e) => setChildren(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Cabin preference</Label>
          <Select value={cabin} onValueChange={setCabin}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Any cabin">Any cabin</SelectItem>
              <SelectItem value="Inside">Inside</SelectItem>
              <SelectItem value="Oceanview">Oceanview</SelectItem>
              <SelectItem value="Balcony">Balcony</SelectItem>
              <SelectItem value="Suite">Suite</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rq-notes">Notes for the quote</Label>
          <Textarea
            id="rq-notes"
            placeholder="Anything the client wants included — drink package, kids' clubs, accessible cabin…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Create Quote Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
