import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, ArrowRight, CheckCircle2, CreditCard, Loader2, RefreshCw, TriangleAlert, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STRIPE_PUBLISHABLE_KEY } from "@/lib/stripePublishableKey";
import { rhInvoke, guestNameError, money, ORDER_STATUS_LABEL, type RoomGuests } from "@/lib/ratehawkApi";
import { cn } from "@/lib/utils";

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

export interface RateHawkBookTarget {
  hid: number;
  hotelId?: string;
  hotelName: string;
  roomName?: string;
  bookHash: string;
  amount: number;
  currency: string;
  cancellation: any;
  checkin: string;
  checkout: string;
  residency: string;
  guests: RoomGuests[];
  tripId?: string | null;
}

/** Resume an order whose finish failed with correctable guest details. */
export interface RateHawkResume {
  orderId: string;
  hotelName: string;
  amount: number;
  currency: string;
  guests: RoomGuests[];
  paymentCaptured: boolean;
  message?: string | null;
}

type Step = "prebooking" | "price_change" | "form" | "guests" | "payment" | "submitting" | "status" | "error";

type GuestRow = { first_name: string; last_name: string; is_child: boolean; age?: number };

function buildRooms(guests: RoomGuests[]): GuestRow[][] {
  return guests.map((g) => [
    ...Array.from({ length: g.adults }, () => ({ first_name: "", last_name: "", is_child: false })),
    ...g.children.map((age) => ({ first_name: "", last_name: "", is_child: true, age })),
  ]);
}

function describePolicy(p: any): string {
  if (!p) return "Not provided";
  const free = p.free_cancellation_before;
  if (free) return `Free cancellation before ${new Date(free).toLocaleString()}`;
  if (Array.isArray(p.policies) && p.policies.length) return "Non-refundable or penalty applies (see policy)";
  return "Not provided";
}

const STAGES = [
  { key: "prebook", label: "Rate confirmed" },
  { key: "form", label: "Booking form" },
  { key: "payment", label: "Guest deposit" },
  { key: "finish", label: "Submitted to RateHawk" },
  { key: "final", label: "Confirmation" },
];

export function RateHawkBookingDialog({
  open, onOpenChange, target, resume, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target?: RateHawkBookTarget | null;
  resume?: RateHawkResume | null;
  onDone?: () => void;
}) {
  const [step, setStep] = useState<Step>("prebooking");
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState<string | undefined>();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [prebook, setPrebook] = useState<any>(null);
  const [acceptChange, setAcceptChange] = useState(false);
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [rooms, setRooms] = useState<GuestRow[][]>([]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [deposit, setDeposit] = useState("");
  const [touched, setTouched] = useState(false);
  const [paymentCaptured, setPaymentCaptured] = useState(false);
  const [sandboxBypass, setSandboxBypass] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [piId, setPiId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [stageDone, setStageDone] = useState(0);
  const cancelled = useRef(false);
  const hotelName = target?.hotelName ?? resume?.hotelName ?? "Hotel";

  const reset = useCallback(() => {
    cancelled.current = false;
    setError(null); setPrebook(null); setAcceptChange(false); setClientSecret(null); setPiId(null);
    setResult(null); setNotice(null); setElapsed(0); setTouched(false); setSandboxBypass(false);
    setEmail(""); setPhone(""); setComment("");
  }, []);

  // Kick off prebook (or resume) when opened.
  useEffect(() => {
    if (!open) { cancelled.current = true; return; }
    reset();
    if (resume) {
      setOrderId(resume.orderId); setAmount(resume.amount); setCurrency(resume.currency);
      setRooms(buildRooms(resume.guests)); setDeposit(String(resume.amount));
      setPaymentCaptured(resume.paymentCaptured); setNotice(resume.message ?? null);
      setStageDone(resume.paymentCaptured ? 3 : 2); setStep("guests");
      return;
    }
    if (!target) return;
    setOrderId(null); setPaymentCaptured(false); setStageDone(0);
    setRooms(buildRooms(target.guests)); setCurrency(target.currency);
    setStep("prebooking");
    (async () => {
      try {
        const r = await rhInvoke("prebook", {
          book_hash: target.bookHash, expected_amount: target.amount,
          expected_cancellation_penalties: target.cancellation ?? null,
          checkin: target.checkin, checkout: target.checkout, guests: target.guests,
          residency: target.residency, currency: target.currency, hid: target.hid,
          hotel_id: target.hotelId, hotel_name: target.hotelName, room_name: target.roomName,
          trip_id: target.tripId ?? null,
        });
        if (cancelled.current) return;
        setEnv(r._env); setOrderId(r.order_id); setPrebook(r);
        setAmount(Number(r.price?.current ?? target.amount)); setDeposit(String(r.price?.current ?? target.amount));
        setStageDone(1);
        if (r.requires_confirmation) setStep("price_change");
        else await createForm(r.order_id, false);
      } catch (e: any) {
        if (!cancelled.current) { setError(e.message); setStep("error"); }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const createForm = async (id: string, accept: boolean) => {
    setStep("form");
    try {
      const r = await rhInvoke("create_booking_form", { order_id: id, accept_price_change: accept });
      if (cancelled.current) return;
      setEnv((e) => e ?? r._env);
      setStageDone(2); setStep("guests");
    } catch (e: any) {
      if (!cancelled.current) { setError(e.message); setStep("error"); }
    }
  };

  // ---- guest validation
  const nameErrors = rooms.map((r) => r.map((g) => ({ first: guestNameError(g.first_name), last: guestNameError(g.last_name) })));
  const hasNameErr = nameErrors.some((r) => r.some((g) => g.first || g.last));
  const emailErr = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : "Valid email required";
  const phoneErr = phone.replace(/\D/g, "").length >= 7 ? null : "Phone required";
  const depositNum = Number(deposit);
  const depositErr = paymentCaptured || sandboxBypass ? null
    : !Number.isFinite(depositNum) || depositNum < 0.5 ? "Enter a deposit of at least 0.50"
    : depositNum > amount * 1.5 ? "Deposit looks too high for this booking" : null;
  const formInvalid = hasNameErr || !!emailErr || !!phoneErr || !!depositErr;

  const updateGuest = (ri: number, gi: number, patch: Partial<GuestRow>) =>
    setRooms((rs) => rs.map((r, i) => i !== ri ? r : r.map((g, j) => j !== gi ? g : { ...g, ...patch })));

  const continueFromGuests = async () => {
    setTouched(true);
    if (formInvalid || !orderId) return;
    if (paymentCaptured || sandboxBypass) return submitFinish(null);
    setStep("payment"); setError(null); setClientSecret(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-flight-payment-intent", {
        body: {
          amount_cents: Math.round(depositNum * 100), currency: currency.toLowerCase(),
          booking_id: orderId, trip_id: target?.tripId ?? "",
          description: `Hotel deposit — ${hotelName}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setClientSecret(data.client_secret); setPiId(data.payment_intent_id);
    } catch (e: any) {
      setError(`Couldn't start the card payment: ${e.message}`);
    }
  };

  const submitFinish = async (paymentIntentId: string | null) => {
    if (!orderId) return;
    setStep("submitting"); setError(null); setStageDone(3); setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    try {
      let r = await rhInvoke("finish_booking", {
        order_id: orderId,
        rooms: rooms.map((r) => ({ guests: r.map((g) => ({ first_name: g.first_name.trim(), last_name: g.last_name.trim(), ...(g.is_child ? { is_child: true, age: g.age } : {}) })) })),
        contact: { email: email.trim(), phone: phone.trim() },
        comment: comment.trim() || undefined,
        ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId, guest_deposit_amount: depositNum } : {}),
        ...(sandboxBypass && !paymentCaptured ? { sandbox_payment_bypass: true } : {}),
      });
      setPaymentCaptured(true); setStageDone(4);
      // Keep checking while RateHawk is still working (server polls ~60s per call).
      let tries = 0;
      while (!cancelled.current && ["processing", "finishing"].includes(r.status) && tries < 4) {
        setResult(r); setStep("status");
        tries++;
        r = await rhInvoke("booking_status", { order_id: orderId });
      }
      if (cancelled.current) return;
      if (r.status === "form_created") {
        // Correctable input error — deposit is held, fix details and resubmit.
        setNotice(r.advisor_message || "RateHawk rejected the guest details. Correct them and resubmit.");
        setStep("guests"); return;
      }
      setResult(r); setStep("status");
      if (r.status === "booked") { setStageDone(5); onDone?.(); }
      else onDone?.();
    } catch (e: any) {
      if (cancelled.current) return;
      setError(e.message);
      setStep(paymentIntentId || paymentCaptured ? "status" : "guests");
      if (paymentIntentId) setPaymentCaptured(true);
      setResult((prev: any) => prev ?? { status: "error", advisor_message: e.message, payment_reference: paymentIntentId });
    } finally {
      clearInterval(timer);
    }
  };

  const recheck = async () => {
    if (!orderId) return;
    setStep("submitting"); setError(null);
    try {
      const r = await rhInvoke("booking_status", { order_id: orderId });
      setResult(r); setStep("status");
      if (r.status === "booked") setStageDone(5);
    } catch (e: any) { setError(e.message); setStep("status"); }
  };

  const busy = ["prebooking", "form", "submitting"].includes(step);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && step === "submitting") return; onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Book {hotelName}
            {env === "sandbox" && <Badge variant="outline" className="text-xs">Sandbox</Badge>}
          </DialogTitle>
          <DialogDescription>
            {target ? `${target.roomName || "Room"} · ${target.checkin} → ${target.checkout} · ${target.guests.length} room${target.guests.length > 1 ? "s" : ""}` : "Resume booking"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STAGES.map((s, i) => (
            <li key={s.key} className={cn("flex items-center gap-1", i < stageDone ? "text-primary" : "text-muted-foreground")}>
              {i < stageDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i === stageDone && busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Circle className="h-3.5 w-3.5" />}
              {s.label}
            </li>
          ))}
        </ol>
        <Separator />

        {step === "prebooking" && <Busy text="Checking the rate is still available with RateHawk…" />}
        {step === "form" && <Busy text="Creating the booking form with RateHawk…" />}

        {step === "error" && (
          <div className="space-y-3">
            <Alert tone="destructive" title="Booking couldn't continue">{error}</Alert>
            <p className="text-sm text-muted-foreground">No payment has been taken. Search again for fresh rates, or try this rate again.</p>
          </div>
        )}

        {step === "price_change" && prebook && (
          <div className="space-y-4">
            <Alert tone="warning" title="The rate changed since search">
              Please confirm the new terms with your guest before continuing.
            </Alert>
            {prebook.price?.changed && (
              <div className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Shown in search</p><p className="font-medium line-through">{money(prebook.price.shown, currency)}</p></div>
                <div><p className="text-muted-foreground text-xs">Current price</p><p className="font-semibold text-lg">{money(prebook.price.current, currency)}</p></div>
                <div><p className="text-muted-foreground text-xs">Difference</p>
                  <p className={cn("font-medium", prebook.price.difference > 0 ? "text-destructive" : "text-primary")}>
                    {prebook.price.difference > 0 ? "+" : ""}{money(prebook.price.difference, currency)} ({prebook.price.difference_pct}%)
                  </p></div>
              </div>
            )}
            {prebook.cancellation?.changed && (
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <p className="font-medium">Cancellation terms changed</p>
                <p><span className="text-muted-foreground">Before:</span> {describePolicy(prebook.cancellation.before)}</p>
                <p><span className="text-muted-foreground">Now:</span> {describePolicy(prebook.cancellation.after)}</p>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={acceptChange} onCheckedChange={(v) => setAcceptChange(v === true)} className="mt-0.5" />
              I confirmed the new price and cancellation terms with the guest.
            </label>
          </div>
        )}

        {step === "guests" && (
          <div className="space-y-5">
            {notice && <Alert tone="warning" title="Correct and resubmit">{notice}</Alert>}
            {error && <Alert tone="destructive" title="Couldn't submit">{error}</Alert>}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
              <span>Booking total (paid to RateHawk from our deposit account)</span>
              <span className="font-semibold">{money(amount, currency)}</span>
            </div>
            {prebook?.price && !prebook.requires_confirmation && (
              <p className="text-xs text-muted-foreground">Price and cancellation terms matched the search result.</p>
            )}
            {rooms.map((room, ri) => (
              <div key={ri} className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-semibold">Room {ri + 1}</p>
                {room.map((g, gi) => {
                  const er = nameErrors[ri][gi];
                  return (
                    <div key={gi} className="grid grid-cols-[110px_1fr_1fr] gap-2 items-start">
                      <div className="pt-2 text-xs text-muted-foreground">
                        {g.is_child ? (g.age === 0 ? "Infant (age 0)" : `Child, age ${g.age}`) : `Adult ${gi + 1}`}
                      </div>
                      <div>
                        <Input aria-label={`Room ${ri + 1} guest ${gi + 1} first name`} placeholder="First name" value={g.first_name}
                          onChange={(e) => updateGuest(ri, gi, { first_name: e.target.value })}
                          aria-invalid={!!(er.first && (touched || g.first_name))} />
                        {er.first && (touched || g.first_name) && <p className="text-xs text-destructive mt-1">{er.first}</p>}
                      </div>
                      <div>
                        <Input aria-label={`Room ${ri + 1} guest ${gi + 1} last name`} placeholder="Last name" value={g.last_name}
                          onChange={(e) => updateGuest(ri, gi, { last_name: e.target.value })}
                          aria-invalid={!!(er.last && (touched || g.last_name))} />
                        {er.last && (touched || g.last_name) && <p className="text-xs text-destructive mt-1">{er.last}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Guest email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                {touched && emailErr && <p className="text-xs text-destructive">{emailErr}</p>}
              </div>
              <div className="space-y-1">
                <Label>Guest phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                {touched && phoneErr && <p className="text-xs text-destructive">{phoneErr}</p>}
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Note for the hotel (optional)</Label>
                <Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} />
              </div>
            </div>
            {paymentCaptured ? (
              <Alert tone="info" title="Deposit already collected">Resubmitting won't charge the guest again.</Alert>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1 max-w-xs">
                  <Label>Guest deposit to collect now ({currency})</Label>
                  <Input type="number" min={0.5} step="0.01" value={deposit} disabled={sandboxBypass} onChange={(e) => setDeposit(e.target.value)} />
                  {touched && depositErr && <p className="text-xs text-destructive">{depositErr}</p>}
                </div>
                {env === "sandbox" && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={sandboxBypass} onCheckedChange={(v) => setSandboxBypass(v === true)} />
                    Sandbox test: skip the card deposit (admins only)
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {step === "payment" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
              <span>Guest deposit</span><span className="font-semibold">{money(depositNum, currency)}</span>
            </div>
            {error && <Alert tone="destructive" title="Payment problem">{error} No booking was made. You can try the card again.</Alert>}
            {!clientSecret && !error && <Busy text="Preparing secure card form…" />}
            {clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
                <PayForm amountLabel={money(depositNum, currency)} onPaid={() => submitFinish(piId)} onError={(m) => setError(m)} />
              </Elements>
            )}
          </div>
        )}

        {step === "submitting" && (
          <Busy text={`Waiting for RateHawk to confirm… ${elapsed}s`} sub="RateHawk confirms most bookings within a minute. Please keep this window open." />
        )}

        {step === "status" && result && (
          <StatusPanel result={result} error={error} onRecheck={recheck} />
        )}

        <DialogFooter className="gap-2">
          {step === "price_change" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Don't book</Button>
              <Button disabled={!acceptChange || !orderId} onClick={() => createForm(orderId!, true)}>
                Accept new terms <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {step === "guests" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={continueFromGuests} disabled={touched && formInvalid}>
                {paymentCaptured ? "Resubmit booking" : sandboxBypass ? "Submit booking" : <>Continue to deposit <CreditCard className="h-4 w-4 ml-1" /></>}
              </Button>
            </>
          )}
          {step === "payment" && <Button variant="outline" onClick={() => { setError(null); setStep("guests"); }}>Back to guest details</Button>}
          {(step === "status" || step === "error") && (
            <>
              <Button variant="outline" asChild><Link to="/hotels/orders">View hotel orders</Link></Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayForm({ amountLabel, onPaid, onError }: { amountLabel: string; onPaid: () => void; onError: (m: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.href }, redirect: "if_required" });
      if (error) onError(error.message || "Card was declined");
      else if (paymentIntent?.status === "succeeded") onPaid();
      else onError(`Payment not completed (status: ${paymentIntent?.status})`);
    } catch (err: any) { onError(err.message || "Payment error"); }
    finally { setProcessing(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || processing} className="w-full gap-2">
        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {processing ? "Processing…" : `Charge ${amountLabel} and book`}
      </Button>
    </form>
  );
}

function StatusPanel({ result, error, onRecheck }: { result: any; error: string | null; onRecheck: () => void }) {
  const s = result.status;
  if (s === "booked") {
    return (
      <Alert tone="success" title="Booking confirmed">
        RateHawk order {result.rh_order_id ?? "—"} · our ref {result.partner_order_id}. {result.advisor_message ?? ""}
      </Alert>
    );
  }
  if (s === "processing" || s === "finishing") {
    return (
      <div className="space-y-3">
        <Alert tone="warning" title="Still processing at RateHawk">
          RateHawk hasn't confirmed yet. The deposit is held on this order. We'll keep checking automatically every few minutes — you can also check now or come back to Hotel orders.
        </Alert>
        <Button variant="outline" size="sm" onClick={onRecheck}><RefreshCw className="h-4 w-4 mr-1" /> Check status now</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Alert tone="destructive" title={ORDER_STATUS_LABEL[s] ?? "Booking problem"}>
        {result.advisor_message || error || result.error || "The booking did not complete."}
      </Alert>
      {result.payment_reference && (
        <p className="text-xs text-muted-foreground">Deposit payment reference: <span className="font-mono">{result.payment_reference}</span> — refund or reuse it for a new booking.</p>
      )}
      {result.error_code && <p className="text-xs text-muted-foreground">RateHawk code: <span className="font-mono">{result.error_code}</span></p>}
    </div>
  );
}

function Busy({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground text-sm text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span>{text}</span>
      {sub && <span className="text-xs">{sub}</span>}
    </div>
  );
}

export function Alert({ tone, title, children }: { tone: "destructive" | "warning" | "success" | "info"; title: string; children?: React.ReactNode }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "destructive" ? AlertCircle : TriangleAlert;
  return (
    <div className={cn("flex gap-2 rounded-lg border p-3 text-sm",
      tone === "destructive" && "border-destructive/40 bg-destructive/5",
      tone === "warning" && "border-accent/50 bg-accent/10",
      tone === "success" && "border-primary/40 bg-primary/5",
      tone === "info" && "bg-muted/50")}>
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", tone === "destructive" ? "text-destructive" : "text-primary")} />
      <div><p className="font-medium">{title}</p>{children && <div className="text-muted-foreground mt-0.5">{children}</div>}</div>
    </div>
  );
}
