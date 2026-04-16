import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { DuffelPayments } from "@duffel/components";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DuffelPayBookingDialogProps {
  bookingId: string;
  amount: number;
  currency?: string;
  confirmationNumber: string;
  onPaymentComplete?: () => void;
}

type PayState = "idle" | "creating" | "collecting" | "confirming" | "done" | "error";

export function DuffelPayBookingDialog({
  bookingId,
  amount,
  currency = "USD",
  confirmationNumber,
  onPaymentComplete,
}: DuffelPayBookingDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PayState>("idle");
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    setState("creating");

    try {
      const { data, error } = await supabase.functions.invoke("duffel-flights", {
        body: {
          action: "create_payment_intent",
          amount: amount.toFixed(2),
          currency,
        },
      });
      if (error) throw error;
      const intent = data?.data;
      if (!intent?.client_token) throw new Error("No client token returned");

      setClientToken(intent.client_token);
      setIntentId(intent.id);
      setState("collecting");
    } catch (err: any) {
      console.error("Duffel payment intent error:", err);
      toast.error(err.message || "Failed to initialize payment");
      setState("error");
    }
  };

  const handleSuccess = useCallback(async () => {
    if (!intentId) return;
    setState("confirming");

    try {
      const { data, error } = await supabase.functions.invoke("duffel-flights", {
        body: {
          action: "confirm_payment_intent",
          payment_intent_id: intentId,
        },
      });
      if (error) throw error;

      setState("done");
      toast.success("Payment collected successfully!");
      onPaymentComplete?.();

      // Auto-close after brief delay
      setTimeout(() => {
        setOpen(false);
        setState("idle");
        setClientToken(null);
        setIntentId(null);
      }, 2000);
    } catch (err: any) {
      console.error("Confirm payment error:", err);
      toast.error(err.message || "Failed to confirm payment");
      setState("error");
    }
  }, [intentId, onPaymentComplete]);

  const handleError = useCallback((error: any) => {
    console.error("Card payment error:", error);
    toast.error("Card payment failed. Please try again.");
    setState("error");
  }, []);

  const handleReset = () => {
    setState("idle");
    setClientToken(null);
    setIntentId(null);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-7 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
      >
        <CreditCard className="h-3.5 w-3.5" />
        Pay via Duffel
      </Button>

      <Dialog open={open} onOpenChange={(v) => {
        if (!v && state !== "confirming") {
          setOpen(false);
          handleReset();
        }
      }}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Pay for Booking
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Booking {confirmationNumber}</p>
                <p className="text-xs text-muted-foreground">Duffel flight booking</p>
              </div>
              <p className="text-lg font-bold">
                ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
              </p>
            </div>

            {state === "creating" && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Initializing payment...</span>
              </div>
            )}

            {state === "collecting" && clientToken && (
              <div className="border rounded-lg p-4">
                <p className="text-sm font-medium mb-3">Enter card details</p>
                <DuffelPayments
                  paymentIntentClientToken={clientToken}
                  onSuccessfulPayment={handleSuccess}
                  onFailedPayment={handleError}
                />
              </div>
            )}

            {state === "confirming" && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Confirming payment...</span>
              </div>
            )}

            {state === "done" && (
              <div className="flex items-center justify-center gap-2 py-8 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Payment collected!</span>
              </div>
            )}

            {state === "error" && (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-destructive">Payment failed. Please try again.</p>
                <Button variant="outline" size="sm" onClick={handleOpen}>
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
