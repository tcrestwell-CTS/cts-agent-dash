import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DollarSign, Calendar, Info } from "lucide-react";
import { format, subDays, differenceInMonths, addMonths } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

export interface TripPaymentOptionsSettings {
  currency: string;
  pricing_visibility: string;
  tags: string[];
  allow_pdf_downloads: boolean;
  itinerary_style: string;
  deposit_required: boolean;
  deposit_amount: number;
  deposit_override: boolean;
  payment_mode: string;
  upgrade_notes?: string;
  group_landing_enabled?: boolean;
}

interface TripPaymentOptionsProps {
  tripId: string;
  settings: TripPaymentOptionsSettings;
  tripTotal?: number;
  departDate?: string;
  onSettingsChange: () => void;
  layout?: "vertical" | "horizontal";
}

export function TripPaymentOptions({
  tripId,
  settings,
  tripTotal = 0,
  departDate,
  onSettingsChange,
  layout = "vertical",
}: TripPaymentOptionsProps) {
  const [localSettings, setLocalSettings] = useState<TripPaymentOptionsSettings>(settings);
  const [scheduleStartDate, setScheduleStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [scheduleMonthsOverride, setScheduleMonthsOverride] = useState<string>("");
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const autoDepositAmount = useMemo(() => Math.round(tripTotal * 0.25 * 100) / 100, [tripTotal]);

  const effectiveDeposit = localSettings.deposit_override
    ? localSettings.deposit_amount
    : autoDepositAmount;

  const schedulePreview = useMemo(() => {
    if (localSettings.payment_mode !== "payment_schedule" || !departDate || tripTotal <= 0) return null;

    const finalDueDate = subDays(parseLocalDate(departDate), 90);
    const now = parseLocalDate(scheduleStartDate);
    const deposit = effectiveDeposit;
    const remaining = tripTotal - deposit;
    if (remaining <= 0) return null;

    const overrideMonths = parseInt(scheduleMonthsOverride);
    const monthsUntilFinal =
      overrideMonths && overrideMonths > 0
        ? overrideMonths
        : Math.max(1, differenceInMonths(finalDueDate, now));
    const monthlyAmount = Math.round((remaining / monthsUntilFinal) * 100) / 100;

    const installments: { label: string; amount: number; dueDate: Date }[] = [];
    for (let i = 1; i <= monthsUntilFinal; i++) {
      const dueDate = i === monthsUntilFinal ? finalDueDate : addMonths(now, i);
      const isLast = i === monthsUntilFinal;
      const amount = isLast ? remaining - monthlyAmount * (monthsUntilFinal - 1) : monthlyAmount;
      installments.push({
        label: isLast ? "Final Payment" : `Payment ${i}`,
        amount: Math.round(amount * 100) / 100,
        dueDate,
      });
    }

    return { installments, finalDueDate, monthlyAmount };
  }, [localSettings.payment_mode, departDate, tripTotal, effectiveDeposit, scheduleStartDate, scheduleMonthsOverride]);

  const createScheduledPayments = async () => {
    if (!schedulePreview) return;
    setCreatingSchedule(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        toast.error("You must be logged in");
        return;
      }

      const rows = schedulePreview.installments.map((inst, i) => ({
        user_id: userId,
        trip_id: tripId,
        amount: inst.amount,
        due_date: format(inst.dueDate, "yyyy-MM-dd"),
        payment_date: format(inst.dueDate, "yyyy-MM-dd"),
        payment_type:
          i === schedulePreview.installments.length - 1 ? "final_balance" : "payment",
        status: "pending",
        details: `Installment ${i + 1} of ${schedulePreview.installments.length}`,
      }));

      const { error } = await supabase.from("trip_payments").insert(rows);
      if (error) throw error;

      toast.success(`${rows.length} scheduled payments created`);
      onSettingsChange();
    } catch (err: any) {
      console.error("Error creating scheduled payments:", err);
      toast.error(err?.message || "Failed to create scheduled payments");
    } finally {
      setCreatingSchedule(false);
    }
  };

  const updateSetting = async (field: string, value: any) => {
    const updated = { ...localSettings, [field]: value };
    setLocalSettings(updated);

    const { error } = await supabase
      .from("trips")
      .update({ [field]: value } as any)
      .eq("id", tripId);

    if (error) {
      toast.error("Failed to update setting");
      setLocalSettings(settings);
    } else {
      await syncDepositPaymentIfNeeded(updated);
      onSettingsChange();
    }
  };

  const updateMultipleSettings = async (updates: Record<string, any>) => {
    const updated = { ...localSettings, ...updates };
    setLocalSettings(updated);

    const { error } = await supabase
      .from("trips")
      .update(updates as any)
      .eq("id", tripId);

    if (error) {
      toast.error("Failed to update settings");
      setLocalSettings(settings);
    } else {
      await syncDepositPaymentIfNeeded(updated);
      onSettingsChange();
    }
  };

  const syncDepositPaymentIfNeeded = async (next: TripPaymentOptionsSettings) => {
    const newDeposit = next.deposit_required
      ? (next.deposit_override ? next.deposit_amount : autoDepositAmount)
      : 0;

    const { data: depositRows, error: fetchErr } = await supabase
      .from("trip_payments")
      .select("id, amount, status")
      .eq("trip_id", tripId)
      .eq("payment_type", "deposit")
      .neq("status", "paid")
      .neq("status", "completed");

    if (fetchErr || !depositRows || depositRows.length === 0) return;

    const target = depositRows[0];
    if (Number(target.amount) === Number(newDeposit)) return;

    const { error: updErr } = await supabase
      .from("trip_payments")
      .update({ amount: newDeposit })
      .eq("id", target.id);

    if (!updErr) {
      toast.success(`Deposit due updated to ${formatCurrency(newDeposit)}`);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const paymentModeHelp =
    localSettings.payment_mode === "deposit_balance"
      ? "Client pays deposit, then remaining balance before departure."
      : "Client pays deposit, then equal monthly installments. Final payment due 90 days before departure.";

  const renderDepositSection = () => (
    <div className={`rounded-lg border p-3 bg-muted/30 ${layout === "horizontal" ? "space-y-2" : "space-y-3"}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Deposit Required</Label>
        <Switch
          checked={localSettings.deposit_required}
          onCheckedChange={(v) => {
            if (v) {
              updateMultipleSettings({
                deposit_required: true,
                deposit_amount: localSettings.deposit_override ? localSettings.deposit_amount : autoDepositAmount,
              });
            } else {
              updateSetting("deposit_required", false);
            }
          }}
        />
      </div>

      {localSettings.deposit_required && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">25% of trip total</span>
            <span className="font-semibold">{formatCurrency(autoDepositAmount)}</span>
          </div>

          {tripTotal <= 0 && (
            <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 rounded-md p-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Add bookings to auto-calculate the deposit amount.</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id={`deposit-override-${layout}`}
              checked={localSettings.deposit_override}
              onCheckedChange={(checked) => {
                const isOverride = !!checked;
                if (isOverride) {
                  updateSetting("deposit_override", true);
                } else {
                  updateMultipleSettings({
                    deposit_override: false,
                    deposit_amount: autoDepositAmount,
                  });
                }
              }}
            />
            <Label htmlFor={`deposit-override-${layout}`} className="text-sm cursor-pointer">
              Override deposit amount
            </Label>
          </div>

          {localSettings.deposit_override && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Custom Deposit ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={localSettings.deposit_amount || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setLocalSettings((s) => ({ ...s, deposit_amount: val }));
                }}
                onBlur={(e) =>
                  updateSetting("deposit_amount", parseFloat(e.target.value) || 0)
                }
              />
            </div>
          )}

          <div className="flex items-center justify-between text-sm pt-1 border-t">
            <span className="font-medium">Deposit Amount</span>
            <Badge variant="outline" className="font-semibold">
              {formatCurrency(effectiveDeposit)}
            </Badge>
          </div>
        </>
      )}
    </div>
  );

  const renderSchedulePreview = () =>
    localSettings.payment_mode === "payment_schedule" && localSettings.deposit_required && schedulePreview ? (
      <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-3.5 w-3.5" />
          Schedule Preview
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="space-y-1">
            <Label className="text-xs">Start Date</Label>
            <Input
              type="date"
              value={scheduleStartDate}
              onChange={(e) => setScheduleStartDate(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs"># of Months</Label>
            <Input
              type="number"
              min="1"
              placeholder="Auto"
              value={scheduleMonthsOverride}
              onChange={(e) => setScheduleMonthsOverride(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Deposit (due now)</span>
            <span className="font-semibold">{formatCurrency(effectiveDeposit)}</span>
          </div>
          {schedulePreview.installments.map((inst, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {inst.label} — {format(inst.dueDate, "MMM d, yyyy")}
              </span>
              <span className="font-semibold">{formatCurrency(inst.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs pt-1 border-t font-semibold">
            <span>Total</span>
            <span>{formatCurrency(tripTotal)}</span>
          </div>
        </div>
        <Button
          size="sm"
          className="w-full mt-2"
          onClick={createScheduledPayments}
          disabled={creatingSchedule}
        >
          {creatingSchedule ? "Creating..." : "Create Scheduled Payments"}
        </Button>
        {!departDate && (
          <p className="text-xs text-warning">Set a departure date to calculate the schedule.</p>
        )}
      </div>
    ) : null;

  const renderBalancePreview = () =>
    localSettings.payment_mode === "deposit_balance" && localSettings.deposit_required && tripTotal > 0 ? (
      <div className="space-y-1.5 rounded-lg border p-3 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-3.5 w-3.5" />
          Balance Preview
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Deposit</span>
          <span className="font-semibold">{formatCurrency(effectiveDeposit)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Final Balance
            {departDate && ` (due by ${format(subDays(parseLocalDate(departDate), 90), "MMM d, yyyy")})`}
          </span>
          <span className="font-semibold">{formatCurrency(Math.max(0, tripTotal - effectiveDeposit))}</span>
        </div>
        <div className="flex items-center justify-between text-xs pt-1 border-t font-semibold">
          <span>Total</span>
          <span>{formatCurrency(tripTotal)}</span>
        </div>
      </div>
    ) : null;

  if (layout === "horizontal") {
    return (
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col xl:flex-row xl:items-start gap-4">
            <div className="flex items-center gap-2 min-w-[180px]">
              <DollarSign className="h-4 w-4 text-primary" />
              <div>
                <CardTitle className="text-base">Payment Options</CardTitle>
                <p className="text-xs text-muted-foreground">Configure how clients pay.</p>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Payment Mode</Label>
                <Select
                  value={localSettings.payment_mode}
                  onValueChange={(v) => updateSetting("payment_mode", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit_balance">Deposit + Final Balance</SelectItem>
                    <SelectItem value="payment_schedule">Payment Schedule (Monthly)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{paymentModeHelp}</p>
              </div>

              <div className="space-y-2">
                {renderDepositSection()}
              </div>

              <div className="space-y-2">
                {renderSchedulePreview() || renderBalancePreview() || (
                  <div className="h-full flex items-center justify-center rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    Enable deposit to see payment preview
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Payment Options
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Configure how clients pay for this trip.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Payment Mode</Label>
          <Select
            value={localSettings.payment_mode}
            onValueChange={(v) => updateSetting("payment_mode", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deposit_balance">Deposit + Final Balance</SelectItem>
              <SelectItem value="payment_schedule">Payment Schedule (Monthly)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{paymentModeHelp}</p>
        </div>

        {renderDepositSection()}
        {renderSchedulePreview()}
        {renderBalancePreview()}

        <p className="text-xs text-muted-foreground">
          Client always has the option to pay the full amount at once.
        </p>
      </CardContent>
    </Card>
  );
}
