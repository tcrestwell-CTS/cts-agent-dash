import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Wallet, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DuffelBalancePayButtonProps {
  bookingId: string;
  amount: number;
  currency?: string;
  confirmationNumber: string;
  offerId?: string;
  onPaymentComplete?: () => void;
}

type PayState = "idle" | "confirming" | "processing" | "done" | "error";

export function DuffelBalancePayButton({
  bookingId,
  amount,
  currency = "USD",
  confirmationNumber,
  offerId,
  onPaymentComplete,
}: DuffelBalancePayButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PayState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirmPay = async () => {
    if (!offerId) {
      toast.error("Missing offer ID — balance payment requires an active Duffel offer.");
      return;
    }

    setState("processing");
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke("duffel-flights", {
        body: {
          action: "pay_with_balance",
          booking_id: bookingId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setState("done");
      toast.success("Balance payment completed!");
      onPaymentComplete?.();

      setTimeout(() => {
        setOpen(false);
        setState("idle");
      }, 2000);
    } catch (err: any) {
      console.error("Balance payment error:", err);
      setErrorMsg(err.message || "Balance payment failed");
      setState("error");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-7 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
          setState("confirming");
          setErrorMsg(null);
        }}
      >
        <Wallet className="h-3.5 w-3.5" />
        Pay with Balance
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && state !== "processing") {
            setOpen(false);
            setState("idle");
          }
        }}
      >
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Pay with Duffel Balance
            </DialogTitle>
            <DialogDescription>
              This will charge your Duffel account balance directly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Booking {confirmationNumber}</p>
                <p className="text-xs text-muted-foreground">Flight booking</p>
              </div>
              <p className="text-lg font-bold">
                ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
              </p>
            </div>

            {state === "confirming" && (
              <Button onClick={handleConfirmPay} className="w-full gap-2">
                <Wallet className="h-4 w-4" />
                Confirm &amp; Pay ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Button>
            )}

            {state === "processing" && (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Processing balance payment...</span>
              </div>
            )}

            {state === "done" && (
              <div className="flex items-center justify-center gap-2 py-6 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Payment completed!</span>
              </div>
            )}

            {state === "error" && (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-destructive">{errorMsg || "Payment failed."}</p>
                <Button variant="outline" size="sm" onClick={() => setState("confirming")}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
