import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Hotel, Loader2, RefreshCw, XCircle } from "lucide-react";
import { rhInvoke, money, ORDER_STATUS_LABEL, statusVariant } from "@/lib/ratehawkApi";
import { RateHawkBookingDialog, Alert, type RateHawkResume } from "@/components/hotels/RateHawkBookingDialog";
import { supabase } from "@/integrations/supabase/client";

export default function RateHawkOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [resume, setResume] = useState<RateHawkResume | null>(null);

  const load = async () => {
    setLoading(true);
    try { const r = await rhInvoke("list_orders"); setOrders(r.orders ?? []); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openResume = async (o: any) => {
    const { data } = await supabase.from("ratehawk_orders").select("search_guests, payment_status, prebook_amount, currency, hotel_name, advisor_message").eq("id", o.id).maybeSingle();
    if (!data) return toast.error("Order not found");
    setResume({ orderId: o.id, hotelName: data.hotel_name ?? "Hotel", amount: Number(data.prebook_amount ?? 0), currency: data.currency ?? "USD",
      guests: (data.search_guests as any) ?? [], paymentCaptured: data.payment_status === "captured", message: data.advisor_message });
    setSelected(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Link to="/hotels" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Hotel search</Link>
            <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.025em] text-foreground">
              <Hotel className="h-[17px] w-[17px] text-primary" /> Hotel orders (RateHawk)
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Your RateHawk bookings, their live status, and cancellations.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading orders…</div>
            ) : orders.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No RateHawk orders yet. Book from Hotel search → RateHawk.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Hotel</TableHead><TableHead>Dates</TableHead><TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead><TableHead>Note</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o)}>
                      <TableCell className="font-medium">{o.hotel_name ?? "—"}<div className="text-xs text-muted-foreground font-mono">{o.rh_order_id ?? o.partner_order_id}</div></TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{o.checkin} → {o.checkout}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{money(o.prebook_amount, o.currency)}</TableCell>
                      <TableCell><Badge variant={statusVariant(o.status)}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{o.advisor_message ?? ""}</TableCell>
                      <TableCell><Button variant="ghost" size="sm">Details</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <OrderSheet order={selected} onClose={() => setSelected(null)} onChanged={load} onResume={openResume} />
      <RateHawkBookingDialog open={!!resume} onOpenChange={(v) => !v && setResume(null)} resume={resume} onDone={load} />
    </DashboardLayout>
  );
}

function OrderSheet({ order, onClose, onChanged, onResume }: { order: any | null; onClose: () => void; onChanged: () => void; onResume: (o: any) => void }) {
  const [info, setInfo] = useState<any>(null);
  const [infoErr, setInfoErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);
  const [ack, setAck] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [checking, setChecking] = useState(false);

  const status = info?.status ?? order?.status;

  const fetchInfo = async () => {
    if (!order) return;
    setLoading(true); setInfoErr(null);
    try { const r = await rhInvoke("order_info", { order_id: order.id }); setInfo(r); if (r.drift) onChanged(); }
    catch (e: any) { setInfoErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    setInfo(null); setQuote(null); setAck(false);
    if (order && ["booked", "cancelled", "needs_attention"].includes(order.status)) fetchInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  const checkStatus = async () => {
    setChecking(true);
    try { const r = await rhInvoke("booking_status", { order_id: order.id }); toast.info(`Status: ${ORDER_STATUS_LABEL[r.status] ?? r.status}`); setInfo((i: any) => ({ ...(i ?? {}), ...r })); onChanged(); }
    catch (e: any) { toast.error(e.message); }
    finally { setChecking(false); }
  };

  const getQuote = async () => {
    setQuoting(true); setAck(false);
    try { const r = await rhInvoke("cancel_quote", { order_id: order.id }); setQuote(r); if (r.status && r.status !== "booked") { setInfo(r); onChanged(); } }
    catch (e: any) { toast.error(e.message); }
    finally { setQuoting(false); }
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      const r = await rhInvoke("cancel_booking", { order_id: order.id, confirm: true, acknowledge_penalty: quote?.quote?.kind !== "free" ? ack : undefined });
      setInfo(r); setQuote(null); onChanged();
      if (r.status === "cancelled") toast.success("Booking cancelled at RateHawk");
      else toast.error(r.advisor_message || "Cancellation not confirmed yet");
    } catch (e: any) { toast.error(e.message); }
    finally { setCancelling(false); }
  };

  const q = quote?.quote;
  const cur = q?.currency || order?.currency || "USD";
  const rh = info?.ratehawk;

  return (
    <Sheet open={!!order} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        {order && (
          <div className="space-y-5">
            <SheetHeader>
              <SheetTitle>{order.hotel_name ?? "Hotel order"}</SheetTitle>
              <SheetDescription>{order.checkin} → {order.checkout} · {money(order.prebook_amount, order.currency)}</SheetDescription>
            </SheetHeader>
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(status)}>{ORDER_STATUS_LABEL[status] ?? status}</Badge>
              {info?.drift && <Badge variant="outline">Updated to match RateHawk</Badge>}
            </div>

            <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Our reference</dt><dd className="font-mono text-xs break-all">{order.partner_order_id}</dd>
              <dt className="text-muted-foreground">RateHawk order</dt><dd className="font-mono text-xs">{rh?.order_id ?? order.rh_order_id ?? "—"}</dd>
              <dt className="text-muted-foreground">Hotel confirmation</dt><dd className="font-mono text-xs">{rh?.hotel_confirmation_number ?? info?.hotel_confirmation_number ?? "—"}</dd>
              <dt className="text-muted-foreground">Guest deposit</dt><dd>{String(order.stripe_payment_intent_id ?? "").startsWith("sandbox-bypass") ? "Skipped (sandbox test)" : order.payment_status === "captured" ? `Collected (${order.stripe_payment_intent_id ?? ""})` : "Not collected"}</dd>
              {info?.free_cancellation_before && (<><dt className="text-muted-foreground">Free cancel before</dt><dd>{new Date(info.free_cancellation_before).toLocaleString()}</dd></>)}
              {info?.cancel_penalty && (<><dt className="text-muted-foreground">Cancel penalty</dt><dd>{money(info.cancel_penalty.amount, info.cancel_penalty.currency)}</dd></>)}
              {info?.guest_refund?.status && (<><dt className="text-muted-foreground">Guest refund</dt><dd>{({ not_applicable: "None due", succeeded: "Refunded", pending: "Pending", failed: "Failed — refund manually" } as Record<string, string>)[info.guest_refund.status] ?? info.guest_refund.status} {info.guest_refund.amount != null ? money(info.guest_refund.amount, order.currency) : ""}</dd></>)}
              {info?.info_synced_at && (<><dt className="text-muted-foreground">Synced with RateHawk</dt><dd>{new Date(info.info_synced_at).toLocaleString()}</dd></>)}
            </dl>

            {(info?.advisor_message ?? order.advisor_message) && (
              <Alert tone={status === "needs_attention" || status === "failed" ? "destructive" : "info"} title="Advisor note">
                {info?.advisor_message ?? order.advisor_message}
              </Alert>
            )}
            {info?.note && <p className="text-xs text-muted-foreground">{info.note}</p>}
            {infoErr && <Alert tone="destructive" title="Couldn't reach RateHawk">{infoErr}</Alert>}

            <div className="flex flex-wrap gap-2">
              {["booked", "cancelled", "needs_attention"].includes(status) && (
                <Button variant="outline" size="sm" onClick={fetchInfo} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />} Refresh from RateHawk
                </Button>
              )}
              {["processing", "finishing"].includes(status) && (
                <Button variant="outline" size="sm" onClick={checkStatus} disabled={checking}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />} Check status now
                </Button>
              )}
              {status === "form_created" && (
                <Button size="sm" onClick={() => onResume(order)}>Complete guest details</Button>
              )}
              {status === "booked" && !quote && (
                <Button variant="destructive" size="sm" onClick={getQuote} disabled={quoting}>
                  {quoting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />} Cancel booking…
                </Button>
              )}
            </div>

            {quote && q && status === "booked" && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="font-medium text-sm">Cancellation quote</p>
                <Alert tone={q.kind === "free" ? "success" : "warning"} title={q.kind === "free" ? "Free cancellation" : q.kind === "non_refundable" ? "Non-refundable" : q.kind === "partial" ? "Penalty applies" : "Cost unknown"}>
                  {quote.message}
                </Alert>
                <dl className="grid grid-cols-[160px_1fr] gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Penalty</dt><dd>{q.penalty != null ? money(q.penalty, cur) : "Unknown"}</dd>
                  <dt className="text-muted-foreground">Booking total</dt><dd>{money(q.total, cur)}</dd>
                  <dt className="text-muted-foreground">Guest deposit</dt><dd>{money(q.guest_deposit, order.currency)}</dd>
                  <dt className="text-muted-foreground">Est. guest refund</dt><dd>{q.estimated_guest_refund != null ? money(q.estimated_guest_refund, order.currency) : "Decided by RateHawk's response"}</dd>
                  <dt className="text-muted-foreground">Source</dt><dd className="text-xs">{q.source === "ratehawk_order_info" ? "Live from RateHawk" : "Saved at booking time"}</dd>
                </dl>
                {q.kind !== "free" && (
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
                    I understand this cancellation has a penalty and the guest agreed.
                  </label>
                )}
                <p className="text-xs text-muted-foreground">Quote is valid for 10 minutes. The actual refund follows what RateHawk confirms.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setQuote(null)}>Keep booking</Button>
                  <Button variant="destructive" size="sm" disabled={cancelling || (q.kind !== "free" && !ack)} onClick={confirmCancel}>
                    {cancelling && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Confirm cancellation
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
