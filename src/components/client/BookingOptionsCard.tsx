import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, CreditCard, Hash, Lock, ThumbsUp, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  useSaveLineSelections,
  useApproveLineSelections,
} from "@/hooks/usePortalData";

type Line = {
  id: string;
  booking_id: string;
  description: string;
  line_type: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  is_addon: boolean;
  is_optional: boolean;
  deposit_amount?: number;
  sort_order: number;
};

type Booking = {
  id: string;
  trip_name?: string;
  destination?: string;
  depart_date?: string;
  status?: string;
  booking_reference?: string;
  total_amount?: number;
  client_selection_locked_at?: string | null;
};

type Selection = {
  booking_id: string;
  margin_line_id: string;
  selected: boolean;
  locked_at: string | null;
};

interface Props {
  tripId: string;
  tripName: string;
  booking: Booking;
  lines: Line[];
  selections: Selection[];
  typeIcon: string;
  typeLabel: string;
  onPayDeposit: (payload: { id: string; amount: number; trip_name: string; payment_type: string }) => void;
  disablePay?: boolean;
  pendingDepositPayment?: { id: string; amount: number; payment_type: string } | null;
  onSelectionChange?: (bookingId: string, picks: Record<string, boolean>) => void;
  readOnly?: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function BookingOptionsCard({
  tripId,
  tripName,
  booking,
  lines,
  selections,
  typeIcon,
  typeLabel,
  onPayDeposit,
  disablePay,
  pendingDepositPayment,
  onSelectionChange,
  readOnly,
}: Props) {
  const saveMutation = useSaveLineSelections();
  const approveMutation = useApproveLineSelections();

  const requiredLines = useMemo(
    () => lines.filter((l) => !l.is_optional),
    [lines]
  );
  const optionalLines = useMemo(
    () => lines.filter((l) => l.is_optional),
    [lines]
  );

  const isLocked = !!booking.client_selection_locked_at;
  const lockedAt = booking.client_selection_locked_at
    ? parseLocalDate(booking.client_selection_locked_at.slice(0, 10))
    : null;

  // Initialize selection state from saved selections (default: selected = true for new optional lines)
  const [picks, setPicks] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    optionalLines.forEach((l) => {
      const saved = selections.find((s) => s.margin_line_id === l.id);
      map[l.id] = saved ? !!saved.selected : true;
    });
    return map;
  });

  // Re-sync when saved selections change from server
  useEffect(() => {
    setPicks((prev) => {
      const next = { ...prev };
      optionalLines.forEach((l) => {
        const saved = selections.find((s) => s.margin_line_id === l.id);
        if (saved) next[l.id] = !!saved.selected;
        else if (next[l.id] === undefined) next[l.id] = true;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections.length, optionalLines.length]);

  // Debounced save when picks change (only when unlocked)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    onSelectionChange?.(booking.id, picks);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (isLocked || readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload = optionalLines.map((l) => ({
        marginLineId: l.id,
        selected: !!picks[l.id],
      }));
      saveMutation.mutate({ tripId, bookingId: booking.id, selections: payload });
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, isLocked]);

  const togglePick = (id: string) => {
    if (isLocked || readOnly) return;
    setPicks((p) => ({ ...p, [id]: !p[id] }));
  };

  const selectedTotal = useMemo(() => {
    const required = requiredLines.reduce((s, l) => s + Number(l.total_price || 0), 0);
    const chosen = optionalLines
      .filter((l) => picks[l.id])
      .reduce((s, l) => s + Number(l.total_price || 0), 0);
    return required + chosen;
  }, [requiredLines, optionalLines, picks]);

  const depositDue = useMemo(() => {
    const required = requiredLines.reduce(
      (s, l) => s + Number(l.deposit_amount || 0),
      0
    );
    const chosen = optionalLines
      .filter((l) => picks[l.id])
      .reduce((s, l) => s + Number(l.deposit_amount || 0), 0);
    const totalDeposit = required + chosen;
    // Fallback: if no per-line deposit set, default to 25% of selected total
    return totalDeposit > 0 ? totalDeposit : Math.round(selectedTotal * 0.25 * 100) / 100;
  }, [requiredLines, optionalLines, picks, selectedTotal]);

  const hasOptional = optionalLines.length > 0;

  const handleApprove = async () => {
    if (readOnly) return;
    try {
      // Force-save current state first
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const payload = optionalLines.map((l) => ({
        marginLineId: l.id,
        selected: !!picks[l.id],
      }));
      await saveMutation.mutateAsync({ tripId, bookingId: booking.id, selections: payload });
      await approveMutation.mutateAsync({ tripId, bookingId: booking.id });
      toast.success("Selection locked in — you can now pay your deposit.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to approve selection");
    }
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Booking header */}
      <div className="flex items-start justify-between p-4">
        <div className="flex gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">
            {typeIcon}
          </div>
          <div>
            <p className="font-medium">{booking.trip_name || booking.destination}</p>
            <p className="text-sm text-muted-foreground">
              {typeLabel} · {booking.destination}
              {booking.depart_date &&
                ` · ${format(parseLocalDate(booking.depart_date), "MMM d, yyyy")}`}
            </p>
            {booking.booking_reference && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/80 border">
                <Hash className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-xs font-semibold tracking-wide">
                  {booking.booking_reference}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
            {booking.status}
          </Badge>
          {hasOptional && (
            <div>
              {isLocked ? (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Lock className="h-3 w-3" /> Locked
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Pending your selection
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lines */}
      {lines.length > 0 && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
          {requiredLines.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Included
              </p>
              <div className="space-y-1.5">
                {requiredLines.map((l) => {
                  const qty = Number(l.quantity || 1);
                  const unit = Number(l.unit_price || 0);
                  const total = Number(l.total_price ?? unit * qty);
                  return (
                    <div
                      key={l.id}
                      className="flex items-start justify-between text-sm gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <span>{l.description}</span>
                        {qty > 1 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({qty} × ${unit.toFixed(2)})
                          </span>
                        )}
                      </div>
                      <span className="font-medium tabular-nums shrink-0">
                        {fmt(total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {optionalLines.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Optional add-ons — choose what you want
              </p>
              <div className="space-y-1.5">
                {optionalLines.map((l) => {
                  const qty = Number(l.quantity || 1);
                  const unit = Number(l.unit_price || 0);
                  const total = Number(l.total_price ?? unit * qty);
                  const checked = !!picks[l.id];
                  return (
                    <label
                      key={l.id}
                      className={`flex items-start justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        isLocked
                          ? "opacity-80"
                          : "cursor-pointer hover:bg-background"
                      } ${checked ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Checkbox
                          checked={checked}
                          disabled={isLocked}
                          onCheckedChange={() => togglePick(l.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <span>{l.description}</span>
                          {qty > 1 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({qty} × ${unit.toFixed(2)})
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`font-medium tabular-nums shrink-0 ${
                          checked ? "" : "text-muted-foreground"
                        }`}
                      >
                        {fmt(total)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Totals + actions */}
          {hasOptional && (
            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your selected total</span>
                <span className="font-semibold tabular-nums">{fmt(selectedTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Deposit due now</span>
                <span className="font-semibold tabular-nums text-primary">
                  {fmt(depositDue)}
                </span>
              </div>

              {isLocked ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    Locked in{lockedAt ? ` on ${format(lockedAt, "MMM d, yyyy")}` : ""}
                  </p>
                  {pendingDepositPayment ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        onPayDeposit({
                          id: pendingDepositPayment.id,
                          amount: Number(pendingDepositPayment.amount) || depositDue,
                          trip_name: tripName,
                          payment_type: pendingDepositPayment.payment_type || "deposit",
                        })
                      }
                      disabled={disablePay}
                    >
                      <CreditCard className="h-4 w-4 mr-1" /> Pay Deposit
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Your agent will send a payment link shortly.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-end">
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={approveMutation.isPending || saveMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-4 w-4 mr-1" />
                    )}
                    Approve Selection
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}