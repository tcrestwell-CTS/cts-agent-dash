import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useTripPayments } from "@/hooks/useTripPayments";
import { TripBooking } from "@/hooks/useTrips";
import { Loader2, CreditCard, Link, FileText, ArrowLeft, ExternalLink, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { applyPaymentToInstallments } from "@/lib/applyPaymentToInstallments";
import { cn } from "@/lib/utils";
import { StripeCheckoutDialog } from "@/components/trips/StripeCheckoutDialog";
import { addMonths, format } from "date-fns";

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  bookings: TripBooking[];
  onPaymentCreated?: () => void;
}

type PaymentMode = null | "stripe_agent" | "stripe_link" | "manual" | "schedule";

const MODES = [
  {
    id: "stripe_agent" as const,
    icon: CreditCard,
    title: "Take Payment",
    description: "Process a card payment right now via Stripe Checkout",
  },
  {
    id: "stripe_link" as const,
    icon: Link,
    title: "Send Payment Link",
    description: "Generate a Stripe link to send to the client",
  },
  {
    id: "manual" as const,
    icon: FileText,
    title: "Log Manually",
    description: "Record a cash, check, or already-processed payment",
  },
  {
    id: "schedule" as const,
    icon: CalendarClock,
    title: "Schedule Payments",
    description: "Split balance into equal monthly installments",
  },
];

const defaultForm = {
  booking_id: "none",
  amount: "",
  payment_date: new Date().toISOString().split("T")[0],
  due_date: "",
  payment_type: "payment",
  payment_method: "none",
  status: "pending",
  details: "",
  notes: "",
};

// ── Shared fields extracted as a proper top-level component to avoid ref warnings ──
interface SharedFieldsProps {
  formData: typeof defaultForm;
  setFormData: (d: typeof defaultForm) => void;
  bookings: TripBooking[];
}

function SharedPaymentFields({ formData, setFormData, bookings }: SharedFieldsProps) {
  const getBookingLabel = (b: TripBooking) => {
    const supplier = b.suppliers?.name || "";
    const dest = b.destination || "";
    const name = b.trip_name || "";
    return name || `${supplier} - ${dest}`.trim() || b.booking_reference;
  };

  const handleBookingChange = (v: string) => {
    const booking = bookings.find((b) => b.id === v);
    const newAmount = booking ? String(booking.gross_sales || "") : formData.amount;
    setFormData({ ...formData, booking_id: v, amount: newAmount });
  };

  return (
    <>
      <div className="space-y-2">
        <Label>Link to Booking (Optional)</Label>
        <Select
          value={formData.booking_id}
          onValueChange={handleBookingChange}
        >
          <SelectTrigger><SelectValue placeholder="Select a booking" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No specific booking</SelectItem>
            {bookings.map((b) => (
              <SelectItem key={b.id} value={b.id}>{getBookingLabel(b)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Amount *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Payment Type</Label>
          <Select
            value={formData.payment_type}
            onValueChange={(v) => setFormData({ ...formData, payment_type: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="deposit">Deposit</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="final_balance">Final Balance</SelectItem>
              <SelectItem value="authorization">Authorization</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Details</Label>
        <Input
          placeholder="e.g., First deposit for cruise"
          value={formData.details}
          onChange={(e) => setFormData({ ...formData, details: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          placeholder="Additional notes..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
        />
      </div>
    </>
  );
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  tripId,
  bookings,
  onPaymentCreated,
}: AddPaymentDialogProps) {
  const { createPayment, creating } = useTripPayments(tripId);
  const [mode, setMode] = useState<PaymentMode>(null);
  const [formData, setFormData] = useState({ ...defaultForm });
  const [stripeLoading, setStripeLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [checkoutPaymentId, setCheckoutPaymentId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Schedule payments state
  const [scheduleTotal, setScheduleTotal] = useState("");
  const [scheduleMonths, setScheduleMonths] = useState("3");
  const [scheduleStartDate, setScheduleStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [scheduleBookingId, setScheduleBookingId] = useState("none");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleCreating, setScheduleCreating] = useState(false);

  const handleClose = (val: boolean) => {
    if (!val) {
      setMode(null);
      setFormData({ ...defaultForm });
      setGeneratedLink(null);
      setScheduleTotal("");
      setScheduleMonths("3");
      setScheduleStartDate(new Date().toISOString().split("T")[0]);
      setScheduleBookingId("none");
      setScheduleNotes("");
    }
    onOpenChange(val);
  };

  // Shared: create a pending payment record and return it
  const createPendingRecord = async () => {
    return createPayment({
      trip_id: tripId,
      booking_id: formData.booking_id === "none" ? null : formData.booking_id,
      amount: parseFloat(formData.amount),
      payment_date: formData.payment_date,
      due_date: formData.due_date || null,
      payment_type: formData.payment_type,
      payment_method: null,
      status: "pending",
      details: formData.details || null,
      notes: formData.notes || null,
    });
  };

  // MODE: Take Payment — open embedded Stripe Checkout inside the app
  const handleStripeAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) return;
    setStripeLoading(true);
    try {
      const record = await createPendingRecord();
      if (!record) return;
      onOpenChange(false);
      setCheckoutPaymentId(record.id);
      setCheckoutOpen(true);
      setFormData({ ...defaultForm });
      setMode(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create payment record");
    } finally {
      setStripeLoading(false);
    }
  };

  // MODE: Send Payment Link
  const handleStripeLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) return;
    setStripeLoading(true);
    try {
      const record = await createPendingRecord();
      if (!record) return;

      const { data, error } = await supabase.functions.invoke("create-stripe-payment", {
        body: { paymentId: record.id, returnUrl: window.location.origin },
      });
      if (error) throw error;
      if (data?.url) {
        setGeneratedLink(data.url);
        onPaymentCreated?.();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate payment link");
    } finally {
      setStripeLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    toast.success("Payment link copied to clipboard!");
  };

  // MODE: Manual log
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) return;
    const result = await createPayment({
      trip_id: tripId,
      booking_id: formData.booking_id === "none" ? null : formData.booking_id,
      amount: parseFloat(formData.amount),
      payment_date: formData.payment_date,
      due_date: formData.due_date || null,
      payment_type: formData.payment_type,
      payment_method: formData.payment_method === "none" ? null : formData.payment_method,
      status: formData.status,
      details: formData.details || null,
      notes: formData.notes || null,
    });
    if (result) {
      setFormData({ ...defaultForm });
      handleClose(false);
      onPaymentCreated?.();
    }
  };

  // MODE: Schedule Payments
  const scheduleMonthsNum = parseInt(scheduleMonths) || 0;
  const scheduleTotalNum = parseFloat(scheduleTotal) || 0;
  const perPayment = scheduleMonthsNum > 0 ? Math.round((scheduleTotalNum / scheduleMonthsNum) * 100) / 100 : 0;
  const lastPayment = scheduleMonthsNum > 0 ? Math.round((scheduleTotalNum - perPayment * (scheduleMonthsNum - 1)) * 100) / 100 : 0;

  const getBookingLabel = (b: TripBooking) => {
    const supplier = b.suppliers?.name || "";
    const dest = b.destination || "";
    const name = b.trip_name || "";
    return name || `${supplier} - ${dest}`.trim() || b.booking_reference;
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scheduleTotalNum <= 0 || scheduleMonthsNum < 2) return;

    setScheduleCreating(true);
    try {
      const startDate = new Date(scheduleStartDate + "T12:00:00");
      for (let i = 0; i < scheduleMonthsNum; i++) {
        const dueDate = addMonths(startDate, i);
        const amount = i < scheduleMonthsNum - 1 ? perPayment : lastPayment;
        await createPayment({
          trip_id: tripId,
          booking_id: scheduleBookingId === "none" ? null : scheduleBookingId,
          amount,
          due_date: format(dueDate, "yyyy-MM-dd"),
          payment_type: i === 0 ? "deposit" : i === scheduleMonthsNum - 1 ? "final_balance" : "payment",
          status: "pending",
          details: `Installment ${i + 1} of ${scheduleMonthsNum}`,
          notes: scheduleNotes || null,
        });
      }
      toast.success(`${scheduleMonthsNum} scheduled payments created`);
      handleClose(false);
      onPaymentCreated?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create scheduled payments");
    } finally {
      setScheduleCreating(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {mode && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -ml-1"
                onClick={() => { setMode(null); setGeneratedLink(null); }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {!mode ? "Add Payment" : MODES.find((m) => m.id === mode)?.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* ── MODE SELECTOR ── */}
        {!mode && (
          <div className="grid gap-3 mt-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex items-start gap-4 rounded-lg border p-4 text-left transition-colors",
                  "hover:bg-muted/60 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
                )}
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <m.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{m.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{m.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── TAKE PAYMENT ── */}
        {mode === "stripe_agent" && (
          <form onSubmit={handleStripeAgentSubmit} className="space-y-4 mt-2">
            <SharedPaymentFields formData={formData} setFormData={setFormData} bookings={bookings} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button type="submit" disabled={stripeLoading || !formData.amount}>
                {stripeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CreditCard className="mr-2 h-4 w-4" />
                Open Stripe Checkout
              </Button>
            </div>
          </form>
        )}

        {/* ── SEND PAYMENT LINK ── */}
        {mode === "stripe_link" && !generatedLink && (
          <form onSubmit={handleStripeLinkSubmit} className="space-y-4 mt-2">
            <SharedPaymentFields formData={formData} setFormData={setFormData} bookings={bookings} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button type="submit" disabled={stripeLoading || !formData.amount}>
                {stripeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Link className="mr-2 h-4 w-4" />
                Generate Link
              </Button>
            </div>
          </form>
        )}

        {/* ── GENERATED LINK RESULT ── */}
        {mode === "stripe_link" && generatedLink && (
          <div className="space-y-4 mt-2">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Payment link ready</p>
              <p className="text-xs text-muted-foreground break-all">{generatedLink}</p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleCopyLink}>Copy Link</Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={generatedLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => handleClose(false)}>Done</Button>
            </div>
          </div>
        )}

        {/* ── MANUAL LOG ── */}
        {mode === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-4 mt-2">
            <SharedPaymentFields formData={formData} setFormData={setFormData} bookings={bookings} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="authorized">Authorized</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="flexpay">Flexpay (Pay Monthly)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !formData.amount}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Log Payment
              </Button>
            </div>
          </form>
        )}

        {/* ── SCHEDULE PAYMENTS ── */}
        {mode === "schedule" && (
          <form onSubmit={handleScheduleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Link to Booking (Optional)</Label>
              <Select value={scheduleBookingId} onValueChange={setScheduleBookingId}>
                <SelectTrigger><SelectValue placeholder="Select a booking" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific booking</SelectItem>
                  {bookings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{getBookingLabel(b)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={scheduleTotal}
                  onChange={(e) => setScheduleTotal(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Number of Payments *</Label>
                <Select value={scheduleMonths} onValueChange={setScheduleMonths}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} payments</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>First Payment Due Date *</Label>
              <Input
                type="date"
                value={scheduleStartDate}
                onChange={(e) => setScheduleStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes for all payments..."
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Preview */}
            {scheduleTotalNum > 0 && scheduleMonthsNum >= 2 && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">Payment Schedule Preview</p>
                <div className="space-y-1">
                  {Array.from({ length: scheduleMonthsNum }).map((_, i) => {
                    const dueDate = addMonths(new Date(scheduleStartDate + "T12:00:00"), i);
                    const amt = i < scheduleMonthsNum - 1 ? perPayment : lastPayment;
                    return (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {i === 0 ? "Deposit" : i === scheduleMonthsNum - 1 ? "Final Balance" : `Payment ${i + 1}`}
                          {" · "}
                          {format(dueDate, "MMM d, yyyy")}
                        </span>
                        <span className="font-medium">{formatCurrency(amt)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(scheduleTotalNum)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button type="submit" disabled={scheduleCreating || scheduleTotalNum <= 0 || scheduleMonthsNum < 2}>
                {scheduleCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CalendarClock className="mr-2 h-4 w-4" />
                Create {scheduleMonthsNum} Payments
              </Button>
            </div>
          </form>
        )}
        </DialogContent>
      </Dialog>

      {checkoutPaymentId && (
        <StripeCheckoutDialog
          open={checkoutOpen}
          onOpenChange={(v) => {
            setCheckoutOpen(v);
            if (!v) {
              setCheckoutPaymentId(null);
              onPaymentCreated?.();
            }
          }}
          paymentId={checkoutPaymentId}
          tripId={tripId}
          onComplete={() => onPaymentCreated?.()}
        />
      )}
    </>
  );
}
