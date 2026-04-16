import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import {
  DuffelCardForm,
  useDuffelCardFormActions,
  createThreeDSecureSession,
} from "@duffel/components";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DuffelPayBookingDialogProps {
  bookingId: string;
  amount: number;
  currency?: string;
  confirmationNumber: string;
  offerId?: string;
  onPaymentComplete?: () => void;
}

type PayState = "idle" | "loading_key" | "collecting" | "processing_3ds" | "creating_order" | "done" | "error";

export function DuffelPayBookingDialog({
  bookingId,
  amount,
  currency = "USD",
  confirmationNumber,
  offerId,
  onPaymentComplete,
}: DuffelPayBookingDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PayState>("idle");
  const [clientKey, setClientKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { ref, createCardForTemporaryUse } = useDuffelCardFormActions();

  const handleOpen = async () => {
    setOpen(true);
    setState("loading_key");
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke("duffel-flights", {
        body: { action: "create_component_client_key" },
      });
      if (error) throw error;
      const key = data?.data?.component_client_key;
      if (!key) throw new Error("No client key returned");

      setClientKey(key);
      setState("collecting");
    } catch (err: any) {
      console.error("Duffel client key error:", err);
      setErrorMsg(err.message || "Failed to initialize card form");
      setState("error");
    }
  };

  const handlePayClick = async () => {
    if (!createCardForTemporaryUse) return;
    // This triggers the DuffelCardForm to tokenize the card
    createCardForTemporaryUse();
  };

  const handleCardCreated = useCallback(
    async (card: { id: string }) => {
      if (!clientKey || !offerId) {
        toast.error("Missing offer information for this booking. Card payment requires an active Duffel offer.");
        setState("error");
        return;
      }

      setState("processing_3ds");

      try {
        // Run 3D Secure session
        const threeDSSession = await createThreeDSecureSession(
          clientKey,
          card.id,
          offerId,
          [], // no ancillary services
          true // live mode
        );

        if (threeDSSession.status !== "ready_for_payment") {
          throw new Error(`3DS authentication failed: ${threeDSSession.status}`);
        }

        setState("creating_order");

        // Create the order with card payment
        const { data, error } = await supabase.functions.invoke("duffel-flights", {
          body: {
            action: "create_order",
            selected_offers: [offerId],
            passengers: [], // already captured at search time
            payments: [
              {
                type: "card",
                currency,
                amount: amount.toFixed(2),
                three_d_secure_session_id: threeDSSession.id,
              },
            ],
          },
        });
        if (error) throw error;

        // Update booking status
        await supabase
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("id", bookingId);

        setState("done");
        toast.success("Card payment completed successfully!");
        onPaymentComplete?.();

        setTimeout(() => {
          setOpen(false);
          setState("idle");
          setClientKey(null);
        }, 2000);
      } catch (err: any) {
        console.error("Card payment error:", err);
        setErrorMsg(err.message || "Card payment failed");
        setState("error");
      }
    },
    [clientKey, offerId, amount, currency, bookingId, onPaymentComplete]
  );

  const handleCardError = useCallback((error: { message?: string }) => {
    console.error("Card form error:", error);
    setErrorMsg(error.message || "Card capture failed");
    setState("error");
  }, []);

  const handleReset = () => {
    setState("idle");
    setClientKey(null);
    setErrorMsg(null);
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
        Pay with Card
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && state !== "processing_3ds" && state !== "creating_order") {
            setOpen(false);
            handleReset();
          }
        }}
      >
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
                <p className="text-xs text-muted-foreground">Flight booking</p>
              </div>
              <p className="text-lg font-bold">
                ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
              </p>
            </div>

            {state === "loading_key" && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading card form...</span>
              </div>
            )}

            {state === "collecting" && clientKey && (
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium mb-3">Enter card details</p>
                  <DuffelCardForm
                    ref={ref}
                    tokenProxyEnvironment="live"
                    clientKey={clientKey}
                    intent={{ amount: amount.toFixed(2), currency }}
                    onValidateSuccess={() => {}}
                    onValidateFailure={() => {}}
                    onCreateCardForTemporaryUseSuccess={handleCardCreated}
                    onCreateCardForTemporaryUseFailure={handleCardError}
                  />
                </div>
                <Button onClick={handlePayClick} className="w-full gap-2">
                  <CreditCard className="h-4 w-4" />
                  Pay ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Button>
              </div>
            )}

            {state === "processing_3ds" && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Authenticating payment (3D Secure)...</span>
              </div>
            )}

            {state === "creating_order" && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Processing payment...</span>
              </div>
            )}

            {state === "done" && (
              <div className="flex items-center justify-center gap-2 py-8 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Payment completed!</span>
              </div>
            )}

            {state === "error" && (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-destructive">{errorMsg || "Payment failed. Please try again."}</p>
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
