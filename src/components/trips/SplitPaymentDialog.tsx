import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Users, AlertTriangle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { addMonths, format } from "date-fns";
import { TripBooking } from "@/hooks/useTrips";
import { useTripTravelers } from "@/hooks/useTripTravelers";
import {
  useBookingPayerShares,
  useSaveBookingPayerShares,
  PayerShareInput,
} from "@/hooks/useBookingPayerShares";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { isInvoiceCashPayment } from "@/hooks/useTripPayments";

interface SplitPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  bookings: TripBooking[];
  defaultBookingId?: string;
  defaultPayers?: number;
  onSaved?: () => void;
}

interface EditableShare extends PayerShareInput {
  key: string;
}

const currency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

const newKey = () => Math.random().toString(36).slice(2);

export function SplitPaymentDialog({
  open,
  onOpenChange,
  tripId,
  bookings,
  defaultBookingId,
  defaultPayers,
  onSaved,
}: SplitPaymentDialogProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const payerDefault = defaultPayers || profile?.default_split_payers || 2;
  const payableBookings = useMemo(
    () => bookings.filter((b) => b.status !== "cancelled"),
    [bookings]
  );
  const [bookingId, setBookingId] = useState<string>(defaultBookingId || payableBookings[0]?.id || "");
  const { data: travelers = [] } = useTripTravelers(tripId);
  const { data: existingShares = [], isLoading: sharesLoading } = useBookingPayerShares(bookingId || undefined);
  const saveShares = useSaveBookingPayerShares();

  const [shares, setShares] = useState<EditableShare[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [createSchedule, setCreateSchedule] = useState(false);
  const [months, setMonths] = useState("3");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const booking = payableBookings.find((b) => b.id === bookingId);
  const bookingGross = Number(booking?.gross_sales || (booking as any)?.total_price || 0);
  const [alreadyPaid, setAlreadyPaid] = useState(0);
  const [outstandingScheduled, setOutstandingScheduled] = useState(0);

  // Only the unpaid balance can be split — payments already logged stay put.
  // Payments may be logged at trip level (booking_id null) or on the booking.
  useEffect(() => {
    if (!open || !bookingId || !tripId) {
      setAlreadyPaid(0);
      setOutstandingScheduled(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("trip_payments")
        .select("amount, status, booking_id, due_date, payment_date, payment_method, stripe_session_id, stripe_receipt_url, payment_type, details")
        .eq("trip_id", tripId);
      if (cancelled) return;
      if (error) {
        console.error("SplitPaymentDialog: failed to load payments", error);
        setAlreadyPaid(0);
        setOutstandingScheduled(0);
        return;
      }
      const scoped = (data || []).filter(
        (p: any) => !p.booking_id || p.booking_id === bookingId
      );
      const paid = scoped
        .filter((p: any) => isInvoiceCashPayment(p))
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      const outstanding = scoped
        .filter((p: any) => p.status === "pending" || p.status === "overdue")
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      setAlreadyPaid(Math.round(paid * 100) / 100);
      setOutstandingScheduled(Math.round(outstanding * 100) / 100);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, bookingId, tripId]);

  // Prefer the actual outstanding scheduled balance when a schedule exists;
  // otherwise fall back to booking gross minus what has been paid.
  const bookingTotal =
    outstandingScheduled > 0
      ? outstandingScheduled
      : Math.max(0, Math.round((bookingGross - alreadyPaid) * 100) / 100);

  // Seed the editor: existing shares when present, otherwise an equal split.
  useEffect(() => {
    if (!open || !bookingId || sharesLoading) return;
    if (existingShares.length > 0) {
      setShares(
        existingShares.map((s) => ({
          key: s.id,
          id: s.id,
          traveler_id: s.traveler_id,
          payer_name: s.payer_name,
          payer_email: s.payer_email,
          share_amount: Number(s.share_amount),
        }))
      );
    } else {
      const count = Math.max(2, Math.min(payerDefault, 8));
      const each = Math.round(((bookingTotal || 0) / count) * 100) / 100;
      setShares(
        Array.from({ length: count }).map((_, i) => {
          const t = travelers[i];
          return {
            key: newKey(),
            traveler_id: t?.id || null,
            payer_name: t ? `${t.first_name} ${t.last_name || ""}`.trim() : "",
            payer_email: t?.email || "",
            share_amount: each,
          } as EditableShare;
        })
      );
    }
    setRemovedIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingId, sharesLoading, existingShares.length, bookingTotal, payerDefault]);

  const allocated = shares.reduce((sum, s) => sum + (Number(s.share_amount) || 0), 0);
  const remaining = Math.round((bookingTotal - allocated) * 100) / 100;

  const splitEqually = () => {
    const count = shares.length || 1;
    const each = Math.floor((bookingTotal / count) * 100) / 100;
    const drift = Math.round((bookingTotal - each * count) * 100) / 100;
    setShares((prev) =>
      prev.map((s, i) => ({ ...s, share_amount: i === 0 ? Math.round((each + drift) * 100) / 100 : each }))
    );
  };

  const updateShare = (key: string, patch: Partial<EditableShare>) => {
    setShares((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const pickTraveler = (key: string, travelerId: string) => {
    if (travelerId === "manual") {
      updateShare(key, { traveler_id: null });
      return;
    }
    const t = travelers.find((tr) => tr.id === travelerId);
    if (!t) return;
    updateShare(key, {
      traveler_id: t.id,
      payer_name: `${t.first_name} ${t.last_name || ""}`.trim(),
      payer_email: t.email || "",
    });
  };

  const addPayer = () => setShares((prev) => [...prev, { key: newKey(), payer_name: "", payer_email: "", share_amount: 0 }]);

  const removePayer = (key: string) => {
    setShares((prev) => {
      const target = prev.find((s) => s.key === key);
      if (target?.id) setRemovedIds((ids) => [...ids, target.id!]);
      return prev.filter((s) => s.key !== key);
    });
  };

  const handleSave = async () => {
    if (!bookingId) {
      toast.error("Select a booking to split");
      return;
    }
    const valid = shares.filter((s) => s.payer_name.trim().length > 0);
    if (valid.length < 2) {
      toast.error("Add at least two payers");
      return;
    }
    if (Math.abs(remaining) > 0.01) {
      toast.error(`Shares must add up to ${currency(bookingTotal)} — ${currency(Math.abs(remaining))} ${remaining > 0 ? "unallocated" : "over"}`);
      return;
    }

    setSaving(true);
    try {
      const saved = await saveShares.mutateAsync({
        bookingId,
        tripId,
        shares: valid.map(({ key, ...rest }) => rest),
        removedIds,
      });

      if (createSchedule && user) {
        const monthCount = Math.max(1, Math.min(parseInt(months) || 1, 24));
        const rows: any[] = [];
        (saved || []).forEach((share) => {
          const each = Math.floor((Number(share.share_amount) / monthCount) * 100) / 100;
          const drift = Math.round((Number(share.share_amount) - each * monthCount) * 100) / 100;
          for (let i = 0; i < monthCount; i++) {
            rows.push({
              user_id: user.id,
              trip_id: tripId,
              booking_id: bookingId,
              amount: i === 0 ? Math.round((each + drift) * 100) / 100 : each,
              due_date: format(addMonths(new Date(startDate), i), "yyyy-MM-dd"),
              payment_date: null,
              payment_type: i === monthCount - 1 ? "final_balance" : "installment",
              status: "pending",
              details: `${share.payer_name} — installment ${i + 1} of ${monthCount}`,
              payer_traveler_id: share.traveler_id,
              payer_name: share.payer_name,
              payer_email: share.payer_email,
            });
          }
        });
        if (rows.length > 0) {
          const { error } = await supabase.from("trip_payments").insert(rows);
          if (error) throw error;
        }
      }

      toast.success(
        createSchedule
          ? "Split saved and payment schedules created for each payer"
          : "Payer split saved"
      );
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Failed to save split", err);
      toast.error(err?.message || "Failed to save split");
    } finally {
      setSaving(false);
    }
  };

  const bookingLabel = (b: TripBooking) =>
    b.trip_name || `${b.suppliers?.name || ""}${b.destination ? ` – ${b.destination}` : ""}`.trim() || b.booking_reference || "Booking";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Split Payment Between Travelers
          </DialogTitle>
          <DialogDescription>
            One booking, multiple payers. Each payer gets their own Stripe payment link for their
            share, while the booking keeps a single invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="space-y-2">
            <Label>Booking</Label>
            <Select value={bookingId} onValueChange={setBookingId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a booking" />
              </SelectTrigger>
              <SelectContent>
                {payableBookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {bookingLabel(b)} — {currency(Number(b.gross_sales || (b as any).total_price || 0))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {alreadyPaid > 0 || outstandingScheduled > 0 ? "Balance due to split" : "Booking total"}
              </p>
              <p className="text-lg font-semibold">{currency(bookingTotal)}</p>
              {alreadyPaid > 0 && (
                <p className="text-xs text-muted-foreground">
                  {currency(alreadyPaid)} already collected on {currency(bookingGross)} booking
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Unallocated</p>
              <p
                className={
                  Math.abs(remaining) < 0.01
                    ? "text-lg font-semibold text-success"
                    : "text-lg font-semibold text-warning"
                }
              >
                {currency(remaining)}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={splitEqually}>
              Split equally
            </Button>
          </div>

          <div className="space-y-3">
            {shares.map((s, idx) => (
              <div key={s.key} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Payer {idx + 1}</Badge>
                  {shares.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removePayer(s.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Traveler</Label>
                    <Select value={s.traveler_id || "manual"} onValueChange={(v) => pickTraveler(s.key, v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose traveler" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Enter name &amp; email manually</SelectItem>
                        {travelers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {`${t.first_name} ${t.last_name || ""}`.trim()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Share amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={s.share_amount}
                      onChange={(e) =>
                        updateShare(s.key, { share_amount: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      placeholder="Payer name"
                      value={s.payer_name}
                      onChange={(e) => updateShare(s.key, { payer_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="payer@email.com"
                      value={s.payer_email || ""}
                      onChange={(e) => updateShare(s.key, { payer_email: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addPayer}>
              <Plus className="h-4 w-4 mr-2" /> Add payer
            </Button>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Create a payment schedule per payer</p>
                <p className="text-xs text-muted-foreground">
                  Each payer gets their own monthly installments, tagged with their name.
                </p>
              </div>
              <Switch checked={createSchedule} onCheckedChange={setCreateSchedule} />
            </div>
            {createSchedule && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Number of months</Label>
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    value={months}
                    onChange={(e) => setMonths(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>First due date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <CreditCard className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Splitting applies to Stripe card payments. Affirm, Uplift FlexPay, virtual cards, and
              manually logged cash or check payments are unchanged.
            </p>
          </div>

          {Math.abs(remaining) > 0.01 && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-xs text-warning">
                Shares must total the booking amount before saving.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || !bookingId}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Split
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
