import { useState } from "react";
import { format } from "date-fns";
import {
  ExternalLink,
  DollarSign,
  Mail,
  Phone,
  Link2,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getProviderMeta } from "@/lib/carRentalProviders";
import { getProviderPortal } from "@/lib/carRentalPortals";

interface Props {
  rental: any;
  onChanged: () => void | Promise<void>;
}

function StepHeader({ n, title, done, locked }: { n: number; title: string; done?: boolean; locked?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        className={
          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
          (done
            ? "bg-green-600 text-white"
            : locked
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground")
        }
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : n}
      </div>
      <h4 className={"text-sm font-semibold " + (locked ? "text-muted-foreground" : "")}>{title}</h4>
    </div>
  );
}

export function CarRentalWorkflow({ rental, onChanged }: Props) {
  const { toast } = useToast();
  const prov = getProviderMeta(rental.provider);
  const portal = getProviderPortal(rental.provider);

  const [quotePrice, setQuotePrice] = useState<string>(
    rental.quoted_price != null ? String(rental.quoted_price) : ""
  );
  const [confirmation, setConfirmation] = useState<string>(rental.confirmation_number ?? "");
  const [actualTotal, setActualTotal] = useState<string>(
    rental.actual_total != null ? String(rental.actual_total) : ""
  );
  const [confirmNotes, setConfirmNotes] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  const hasQuote = rental.quoted_price != null;
  const quoteSent = !!rental.quote_sent_at;
  const cardCollected = !!rental.cc_full_collected;
  const isConfirmed = rental.status === "confirmed" || rental.status === "completed";

  async function patch(updates: Record<string, unknown>, label: string) {
    setBusy(label);
    const { error } = await supabase
      .from("car_rental_requests")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", rental.id);
    setBusy(null);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return false;
    }
    await onChanged();
    toast({ title: label });
    return true;
  }

  async function saveQuote() {
    const num = Number(quotePrice);
    if (!quotePrice || Number.isNaN(num) || num <= 0) {
      toast({ title: "Enter a valid price", variant: "destructive" });
      return;
    }
    await patch({ quoted_price: num }, "Quote saved");
  }

  async function sendQuoteEmail() {
    setBusy("Sending quote");
    const { error } = await supabase.functions.invoke("send-rental-quote", {
      body: { rentalId: rental.id },
    });
    setBusy(null);
    if (error) {
      toast({ title: "Email failed", description: error.message, variant: "destructive" });
      return;
    }
    await patch(
      { quote_sent_at: new Date().toISOString(), status: "pending" },
      "Quote email sent"
    );
  }

  async function markCollectedByPhone() {
    const { data: userData } = await supabase.auth.getUser();
    await patch(
      {
        cc_collection_method: "phone",
        cc_collected_at: new Date().toISOString(),
        cc_collected_by: userData?.user?.id ?? null,
        cc_full_collected: true,
      },
      "Marked collected by phone"
    );
  }

  async function sendSecureLink() {
    setBusy("Generating link");
    const { error } = await supabase.functions.invoke("send-rental-secure-link", {
      body: { rentalId: rental.id },
    });
    setBusy(null);
    if (error) {
      toast({ title: "Failed to send link", description: error.message, variant: "destructive" });
      return;
    }
    await patch({ cc_collection_method: "secure_link" }, "Secure link emailed");
  }

  async function markConfirmed() {
    if (!confirmation.trim()) {
      toast({ title: "Enter a confirmation number", variant: "destructive" });
      return;
    }
    const total = actualTotal ? Number(actualTotal) : null;
    const ok = await patch(
      {
        status: "confirmed",
        confirmation_number: confirmation.trim(),
        actual_total: total,
        cc_authorized: true,
        cc_authorized_at: new Date().toISOString(),
        agent_notes: confirmNotes
          ? `${rental.agent_notes ?? ""}\n[Confirm] ${confirmNotes}`.trim()
          : rental.agent_notes,
      },
      "Booking confirmed"
    );
    if (ok) {
      await supabase.functions.invoke("send-rental-confirmation", {
        body: { rentalId: rental.id },
      });
    }
  }

  const summary = [
    `Pickup: ${rental.pickup_location || "—"} — ${rental.pickup_date || "—"} ${rental.pickup_time || ""}`.trim(),
    `Drop-off: ${rental.dropoff_location || rental.pickup_location || "—"} — ${rental.return_date || "—"} ${rental.return_time || ""}`.trim(),
    `Vehicle: ${rental.vehicle_class || "—"}`,
    `Loyalty #: ${rental.loyalty_number || "None"}`,
  ].join("\n");

  return (
    <div className="rounded-lg border bg-card p-4 space-y-5 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Agent Workflow</h3>
        {busy && (
          <span className="flex items-center text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin mr-1" /> {busy}…
          </span>
        )}
      </div>

      {/* Step 1 */}
      <div>
        <StepHeader n={1} title="Look Up Pricing" done={hasQuote} />
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="outline" className={prov.classes + " border"}>{prov.name}</Badge>
          {portal ? (
            <Button size="sm" variant="outline" asChild>
              <a href={portal} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Open Provider Portal
              </a>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">No portal URL for this provider</span>
          )}
        </div>
        <pre className="text-xs bg-muted/40 p-2 rounded whitespace-pre-wrap font-mono">{summary}</pre>
        <div className="flex items-end gap-2 mt-3">
          <div className="flex-1 max-w-[180px]">
            <Label className="text-xs">Quoted Price ($)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={quotePrice}
              onChange={(e) => setQuotePrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <Button size="sm" onClick={saveQuote} disabled={busy !== null}>
            <DollarSign className="h-4 w-4 mr-1" />
            Save Quote
          </Button>
        </div>
      </div>

      <Separator />

      {/* Step 2 */}
      <div>
        <StepHeader n={2} title="Send Quote to Customer" done={quoteSent} locked={!hasQuote} />
        {!hasQuote ? (
          <p className="text-xs text-muted-foreground">Save a quoted price first.</p>
        ) : (
          <div className="space-y-2">
            <div className="text-sm">
              Quoted total:{" "}
              <span className="font-semibold">${Number(rental.quoted_price).toFixed(2)}</span>
            </div>
            {quoteSent && (
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Sent {format(new Date(rental.quote_sent_at), "PPp")}
                {rental.quote_accepted_at && (
                  <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Customer confirmed {format(new Date(rental.quote_accepted_at), "PPp")}
                  </span>
                )}
              </div>
            )}
            <Button size="sm" variant={quoteSent ? "outline" : "default"} onClick={sendQuoteEmail} disabled={busy !== null}>
              <Mail className="h-4 w-4 mr-1" />
              {quoteSent ? "Resend Quote Email" : "Send Quote Email"}
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Step 3 */}
      <div>
        <StepHeader n={3} title="Collect Payment" done={cardCollected} locked={!quoteSent} />
        {!quoteSent ? (
          <p className="text-xs text-muted-foreground">Send the quote first.</p>
        ) : (
          <div className="space-y-2">
            <div className="text-sm">
              {cardCollected ? (
                <span className="inline-flex items-center gap-1 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Full card collected
                  {rental.cc_collection_method && (
                    <span className="text-muted-foreground">
                      ({rental.cc_collection_method === "phone" ? "by phone" : "via secure link"})
                    </span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" /> Awaiting card collection
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={markCollectedByPhone} disabled={busy !== null}>
                <Phone className="h-4 w-4 mr-1" />
                Mark Collected by Phone
              </Button>
              <Button size="sm" variant="outline" onClick={sendSecureLink} disabled={busy !== null}>
                <Link2 className="h-4 w-4 mr-1" />
                Send Secure Card Link
              </Button>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Step 4 */}
      <div>
        <StepHeader n={4} title="Submit to Provider & Confirm" done={isConfirmed} locked={!cardCollected} />
        {!cardCollected ? (
          <p className="text-xs text-muted-foreground">Collect a full card first.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Provider Confirmation #</Label>
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="ABC123456"
              />
            </div>
            <div>
              <Label className="text-xs">Actual Total ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={actualTotal}
                onChange={(e) => setActualTotal(e.target.value)}
                placeholder={rental.quoted_price ? String(rental.quoted_price) : "0.00"}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Notes (optional)</Label>
              <Input
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder="Any details about the booking…"
              />
            </div>
            <div className="sm:col-span-2">
              <Button size="sm" onClick={markConfirmed} disabled={busy !== null}>
                <ShieldCheck className="h-4 w-4 mr-1" />
                {isConfirmed ? "Update Confirmation" : "Mark as Confirmed"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}