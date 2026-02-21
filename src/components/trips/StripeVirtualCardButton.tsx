import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, Eye, EyeOff, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StripeVirtualCardButtonProps {
  paymentId: string;
  virtualCardStatus: string | null;
  virtualCardId: string | null;
  paymentMethodChoice: string | null;
  paymentMethod: string | null;
  paymentStatus: string;
  amount: number;
  clientName?: string;
  tripName?: string;
}

/**
 * StripeVirtualCardButton
 *
 * Shown on paid trip payments where payment_method_choice === 'stripe'
 * and a virtual_card_id exists. Retrieves card details from the
 * retrieve-virtual-card edge function (Stripe Issuing API).
 */
export function StripeVirtualCardButton({
  paymentId,
  virtualCardStatus,
  virtualCardId,
  paymentMethodChoice,
  paymentMethod,
  paymentStatus,
  amount,
  clientName,
  tripName,
}: StripeVirtualCardButtonProps) {
  const [loading, setLoading] = useState(false);
  const [cardDetails, setCardDetails] = useState<any>(null);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [showNumber, setShowNumber] = useState(false);
  const [showCvc, setShowCvc] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Show for paid Stripe payments — either explicit choice or payment_method is stripe
  const isStripePaid =
    paymentStatus === "paid" &&
    (paymentMethodChoice === "stripe" || (!paymentMethodChoice && paymentMethod === "stripe"));

  if (!isStripePaid) {
    return null;
  }

  const hasCard = virtualCardId && virtualCardStatus === "ready";

  const handleRetrieveCard = async () => {
    setLoading(true);
    try {
      if (hasCard) {
        // Retrieve existing card details
        const { data, error } = await supabase.functions.invoke("retrieve-virtual-card", {
          body: { paymentId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setCardDetails(data);
        setShowCardDialog(true);
        setShowNumber(false);
        setShowCvc(false);
      } else {
        // Issue a new Stripe virtual card
        const { data, error } = await supabase.functions.invoke("create-virtual-card", {
          body: { paymentId, method: "stripe" },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("Stripe virtual card created! Click 'Retrieve Card' to view details.");
        // Trigger a page refresh to update the payment data
        window.location.reload();
      }
    } catch (err: any) {
      console.error("Error with virtual card:", err);
      toast.error(err.message || "Failed to process virtual card");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
    toast.success(`${field} copied`);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const maskNumber = (num: string) =>
    num ? `•••• •••• •••• ${num.slice(-4)}` : "••••";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
        onClick={handleRetrieveCard}
        disabled={loading}
        title={hasCard ? "Retrieve Stripe Issuing virtual card details" : "Issue a Stripe Issuing virtual card"}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CreditCard className="h-3.5 w-3.5" />
        )}
        {hasCard ? "Retrieve Card" : "Issue Card"}
      </Button>

      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Stripe Virtual Card
            </DialogTitle>
            <DialogDescription>
              Use these card details to pay the supplier
              {tripName && <> for <strong>{tripName}</strong></>}.
              {clientName && <> Client: <strong>{clientName}</strong>.</>}
            </DialogDescription>
          </DialogHeader>

          {cardDetails && (
            <div className="space-y-3 mt-2">
              {/* Card visual */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/90 to-primary/60 text-primary-foreground space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-xs uppercase tracking-wider opacity-80">Virtual Card</span>
                  <span className="text-xs font-semibold uppercase">{cardDetails.brand || "Visa"}</span>
                </div>

                {/* Card Number */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg tracking-wider">
                      {showNumber && cardDetails.number
                        ? cardDetails.number.replace(/(.{4})/g, "$1 ").trim()
                        : maskNumber(cardDetails.last4 || "")}
                    </span>
                    <button
                      onClick={() => setShowNumber(!showNumber)}
                      className="opacity-70 hover:opacity-100"
                    >
                      {showNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {cardDetails.number && (
                      <button
                        onClick={() => copyToClipboard(cardDetails.number, "Card number")}
                        className="opacity-70 hover:opacity-100"
                      >
                        {copied === "Card number" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider opacity-70">Expires</span>
                    <p className="font-mono text-sm">
                      {String(cardDetails.exp_month).padStart(2, "0")}/{String(cardDetails.exp_year).slice(-2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider opacity-70">CVC</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm">
                        {showCvc && cardDetails.cvc ? cardDetails.cvc : "•••"}
                      </span>
                      <button
                        onClick={() => setShowCvc(!showCvc)}
                        className="opacity-70 hover:opacity-100"
                      >
                        {showCvc ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                      {cardDetails.cvc && (
                        <button
                          onClick={() => copyToClipboard(cardDetails.cvc, "CVC")}
                          className="opacity-70 hover:opacity-100"
                        >
                          {copied === "CVC" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider opacity-70">Limit</span>
                    <p className="font-mono text-sm">
                      {cardDetails.spending_limit
                        ? formatCurrency(cardDetails.spending_limit)
                        : formatCurrency(amount)}
                    </p>
                  </div>
                </div>

                {cardDetails.cardholder_name && (
                  <p className="text-xs uppercase tracking-wider opacity-80 pt-1">
                    {cardDetails.cardholder_name}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">
                  Status: <strong className="capitalize">{cardDetails.status}</strong>
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                This card is single-use and limited to {formatCurrency(cardDetails.spending_limit || amount)}.
                Use it to pay the supplier directly.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
