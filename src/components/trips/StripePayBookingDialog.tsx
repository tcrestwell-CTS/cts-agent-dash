import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

interface StripePayBookingDialogProps {
  bookingId: string;
  tripId: string;
  amount: number;
  currency?: string;
  confirmationNumber: string;
  offerId?: string;
  onPaymentComplete?: () => void;
}

function CheckoutForm({
  amount,
  currency,
  bookingId,
  onSuccess,
  onError,
}: {
  amount: number;
  currency: string;
  bookingId: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href, // fallback, shouldn't redirect for card
        },
        redirect: "if_required",
      });

      if (error) {
        onError(error.message || "Payment failed");
      } else if (paymentIntent?.status === "succeeded") {
        onSuccess();
      } else {
        onError(`Unexpected payment status: ${paymentIntent?.status}`);
      }
    } catch (err: any) {
      onError(err.message || "Payment error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || processing} className="w-full gap-2">
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {processing
          ? "Processing..."
          : `Pay $${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`}
      </Button>
    </form>
  );
}

export function StripePayBookingDialog({
  bookingId,
  tripId,
  amount,
  currency = "USD",
  confirmationNumber,
  offerId,
  onPaymentComplete,
}: StripePayBookingDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "booking" | "done" | "error">("idle");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    setState("loading");
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke("create-flight-payment-intent", {
        body: {
          amount_cents: Math.round(amount * 100),
          currency: currency.toLowerCase(),
          booking_id: bookingId,
          trip_id: tripId,
          description: `Flight booking ${confirmationNumber}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setClientSecret(data.client_secret);
      setState("ready");
    } catch (err: any) {
      console.error("Stripe payment init error:", err);
      setErrorMsg(err.message || "Failed to initialize payment");
      setState("error");
    }
  };

  const handlePaymentSuccess = useCallback(async () => {
    setState("booking");
    toast.success("Payment collected! Issuing ticket...");

    try {
      // Auto-book via Duffel balance
      const { data, error } = await supabase.functions.invoke("duffel-flights", {
        body: {
          action: "pay_with_balance",
          booking_id: bookingId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setState("done");
      toast.success("Ticket issued successfully!");
      onPaymentComplete?.();

      setTimeout(() => {
        setOpen(false);
        setState("idle");
        setClientSecret(null);
      }, 2000);
    } catch (err: any) {
      console.error("Duffel booking error after Stripe payment:", err);
      setErrorMsg(`Payment collected but ticket issuance failed: ${err.message}. Contact support.`);
      setState("error");
    }
  }, [bookingId, onPaymentComplete]);

  const handlePaymentError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setState("error");
  }, []);

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
          if (!v && state !== "booking") {
            setOpen(false);
            setState("idle");
            setClientSecret(null);
            setErrorMsg(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Pay for Booking
            </DialogTitle>
            <DialogDescription>
              Collect customer card payment via Stripe, then auto-issue the ticket.
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

            {state === "loading" && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Initializing payment...</span>
              </div>
            )}

            {state === "ready" && clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: { theme: "stripe" },
                }}
              >
                <CheckoutForm
                  amount={amount}
                  currency={currency}
                  bookingId={bookingId}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </Elements>
            )}

            {state === "booking" && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Issuing ticket via Duffel...</span>
              </div>
            )}

            {state === "done" && (
              <div className="flex items-center justify-center gap-2 py-8 text-primary">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Payment & ticket complete!</span>
              </div>
            )}

            {state === "error" && (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-destructive">{errorMsg || "Payment failed."}</p>
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
