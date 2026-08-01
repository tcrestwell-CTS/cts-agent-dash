import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MailCheck, Loader2, Sparkles, ArrowLeft, Inbox, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { differenceInDays, format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

export interface ParsedConfirmationItem {
  title: string;
  category: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  flight_number: string | null;
  departure_city_code: string | null;
  arrival_city_code: string | null;
  item_price: number | null;
  confirmation_number: string | null;
}

interface ExistingItemLike {
  title: string;
  notes?: string | null;
  day_number?: number;
}

interface BookingLike {
  id: string;
  booking_reference?: string | null;
  trip_name?: string | null;
  suppliers?: { supplier_name?: string | null; supplier_type?: string | null } | null;
}

interface InboxMessage {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  received_at: string | null;
  body_text: string | null;
}

interface Props {
  tripId: string;
  departDate: string | null;
  returnDate: string | null;
  totalDays: number;
  onAdd: (data: any) => Promise<boolean>;
  variant?: "button" | "sidebar";
  bookings?: BookingLike[];
  existingItems?: ExistingItemLike[];
}

/** Map a parsed calendar date onto a trip day number (1-based). */
function dayNumberFor(date: string | null, departDate: string | null, totalDays: number) {
  if (!date || !departDate) return 1;
  const start = parseLocalDate(departDate);
  const target = parseLocalDate(date);
  if (isNaN(start.getTime()) || isNaN(target.getTime())) return 1;
  const diff = differenceInDays(target, start) + 1;
  if (!isFinite(diff)) return 1;
  return Math.min(Math.max(diff, 1), Math.max(totalDays, 1));
}

const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function ParseConfirmationDialog({
  tripId, departDate, returnDate, totalDays, onAdd, variant = "button",
  bookings = [], existingItems = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"paste" | "inbox">("paste");
  const [emailText, setEmailText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [supplier, setSupplier] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedConfirmationItem[] | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [days, setDays] = useState<Record<number, number>>({});
  const [linkBookingId, setLinkBookingId] = useState<string>("none");
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxMessageId, setInboxMessageId] = useState<string | null>(null);

  const reset = () => {
    setEmailText("");
    setItems(null);
    setSupplier(null);
    setSelected({});
    setDays({});
    setLinkBookingId("none");
    setInboxMessageId(null);
  };

  const isDuplicate = (item: ParsedConfirmationItem) => {
    const title = normalize(item.title);
    const conf = item.confirmation_number ? normalize(item.confirmation_number) : null;
    return existingItems.some((existing) => {
      if (normalize(existing.title || "") === title) return true;
      if (conf && existing.notes && normalize(existing.notes).includes(conf)) return true;
      return false;
    });
  };

  const loadInbox = async () => {
    setInboxLoading(true);
    try {
      const { data, error } = await supabase
        .from("inbox_processed_messages" as any)
        .select("id, subject, from_email, from_name, received_at, body_text")
        .or(`linked_trip_id.eq.${tripId},linked_trip_id.is.null`)
        .in("classification", ["supplier_confirmation", "supplier_update"])
        .is("itinerary_imported_at", null)
        .not("body_text", "is", null)
        .order("received_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      setInboxMessages((data as unknown as InboxMessage[]) || []);
    } catch (err: any) {
      toast.error(err?.message || "Could not load inbox confirmations.");
    } finally {
      setInboxLoading(false);
    }
  };

  useEffect(() => {
    if (open && source === "inbox" && inboxMessages.length === 0 && !inboxLoading) {
      loadInbox();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source]);

  const runParse = async (text: string, messageId?: string) => {
    if (text.trim().length < 40) {
      toast.error("Paste the full confirmation email first.");
      return;
    }
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-supplier-confirmation", {
        body: { email_text: text, depart_date: departDate, return_date: returnDate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const parsed: ParsedConfirmationItem[] = data?.items ?? [];
      setItems(parsed);
      setSupplier(data?.supplier ?? null);
      setInboxMessageId(messageId ?? null);
      setSelected(Object.fromEntries(parsed.map((item, i) => [i, !isDuplicate(item)])));
      setDays(Object.fromEntries(
        parsed.map((item, i) => [i, dayNumberFor(item.date, departDate, totalDays)]),
      ));

      // Auto-suggest a booking to attach to, matched on supplier name
      const supplierName = data?.supplier ? normalize(String(data.supplier)) : null;
      if (supplierName) {
        const match = bookings.find((b) => {
          const name = normalize(b.suppliers?.supplier_name || "");
          return name && (supplierName.includes(name) || name.includes(supplierName));
        });
        if (match) setLinkBookingId(match.id);
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not parse that confirmation.");
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!items) return;
    const chosen = items.map((item, i) => ({ item, i })).filter(({ i }) => selected[i]);
    if (chosen.length === 0) {
      toast.error("Select at least one item to import.");
      return;
    }
    setImporting(true);
    let added = 0;
    for (const { item, i } of chosen) {
      const notes = [
        item.confirmation_number ? `Confirmation: ${item.confirmation_number}` : null,
        supplier ? `Supplier: ${supplier}` : null,
      ].filter(Boolean).join(" · ");
      const ok = await onAdd({
        trip_id: tripId,
        day_number: days[i] ?? 1,
        title: item.title,
        category: item.category,
        description: item.description || undefined,
        location: item.location || undefined,
        start_time: item.start_time || undefined,
        end_time: item.end_time || undefined,
        item_date: item.date || undefined,
        flight_number: item.flight_number || undefined,
        departure_city_code: item.departure_city_code || undefined,
        arrival_city_code: item.arrival_city_code || undefined,
        item_price: item.item_price ?? undefined,
        booking_id: linkBookingId !== "none" ? linkBookingId : undefined,
        notes: notes || undefined,
      });
      if (ok) added++;
    }

    if (added > 0 && inboxMessageId) {
      await supabase
        .from("inbox_processed_messages" as any)
        .update({ itinerary_imported_at: new Date().toISOString() } as any)
        .eq("id", inboxMessageId);
      setInboxMessages((prev) => prev.filter((m) => m.id !== inboxMessageId));
    }

    setImporting(false);
    if (added > 0) {
      toast.success(`Added ${added} itinerary item${added === 1 ? "" : "s"}.`);
      reset();
      setOpen(false);
    } else {
      toast.error("Nothing could be imported.");
    }
  };

  const selectedCount = items ? Object.values(selected).filter(Boolean).length : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {variant === "sidebar" ? (
          <button className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors text-foreground">
            <MailCheck className="h-4 w-4 text-primary" />
            <span>Parse Confirmation Email</span>
          </button>
        ) : (
          <Button variant="outline" size="sm">
            <MailCheck className="h-4 w-4 mr-2" /> Parse Confirmation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-primary" /> Supplier Confirmation → Itinerary
          </DialogTitle>
        </DialogHeader>

        {!items ? (
          <Tabs value={source} onValueChange={(v) => setSource(v as "paste" | "inbox")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste">Paste email</TabsTrigger>
              <TabsTrigger value="inbox">
                <Inbox className="h-3.5 w-3.5 mr-1.5" /> From inbox
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Paste an airline, hotel, cruise, transfer or tour confirmation email. Components are
                extracted for your review — nothing is saved until you approve it.
              </p>
              <Textarea
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                rows={12}
                placeholder="Paste the full confirmation email here..."
                className="font-mono text-xs"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => runParse(emailText)} disabled={parsing}>
                  {parsing
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Sparkles className="h-4 w-4 mr-2" />}
                  {parsing ? "Parsing..." : "Parse email"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="inbox" className="space-y-3 pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Supplier confirmations picked up from your connected mailbox that haven't been
                  imported into an itinerary yet.
                </p>
                <Button variant="ghost" size="sm" onClick={loadInbox} disabled={inboxLoading}>
                  <RefreshCw className={`h-4 w-4 ${inboxLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <ScrollArea className="max-h-[45vh] pr-3">
                <div className="space-y-2">
                  {inboxLoading && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
                  )}
                  {!inboxLoading && inboxMessages.length === 0 && (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No unimported supplier confirmations found. New ones appear here after the
                      mailbox sync runs.
                    </p>
                  )}
                  {inboxMessages.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => runParse(msg.body_text || "", msg.id)}
                      disabled={parsing}
                      className="w-full text-left rounded-lg border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors disabled:opacity-60"
                    >
                      <p className="text-sm font-medium text-card-foreground truncate">
                        {msg.subject || "(no subject)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          msg.from_name || msg.from_email,
                          msg.received_at ? format(new Date(msg.received_at), "MMM d, yyyy") : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{items.length} component{items.length === 1 ? "" : "s"} found</Badge>
              {supplier && <Badge variant="secondary">{supplier}</Badge>}
              <span className="text-muted-foreground">Review, set the day, then import.</span>
            </div>

            {bookings.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Attach imported items to a booking</Label>
                <Select value={linkBookingId} onValueChange={setLinkBookingId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="No booking" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No booking</SelectItem>
                    {bookings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {[b.suppliers?.supplier_name, b.booking_reference || b.trip_name]
                          .filter(Boolean).join(" · ") || "Booking"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <ScrollArea className="max-h-[45vh] pr-3">
              <div className="space-y-2">
                {items.map((item, i) => {
                  const dup = isDuplicate(item);
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <Checkbox
                        checked={!!selected[i]}
                        onCheckedChange={(v) => setSelected({ ...selected, [i]: !!v })}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm text-card-foreground">{item.title}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">{item.category}</Badge>
                          {dup && (
                            <Badge variant="secondary" className="text-[10px]">Already in itinerary</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[
                            item.date,
                            item.start_time
                              ? `${item.start_time}${item.end_time ? `–${item.end_time}` : ""}`
                              : null,
                            item.location,
                            item.confirmation_number ? `Conf ${item.confirmation_number}` : null,
                            item.item_price != null ? `$${item.item_price.toFixed(2)}` : null,
                          ].filter(Boolean).join(" · ") || "No date or time detected"}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                        )}
                      </div>
                      <div className="w-20 shrink-0">
                        <Label className="text-[10px] text-muted-foreground">Day</Label>
                        <Input
                          type="number"
                          min={1}
                          value={days[i] ?? 1}
                          onChange={(e) =>
                            setDays({ ...days, [i]: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="h-8"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setItems(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button onClick={handleImport} disabled={importing || selectedCount === 0}>
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import {selectedCount} item{selectedCount === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
