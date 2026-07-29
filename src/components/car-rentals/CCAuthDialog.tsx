import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
    "pk_live_51RrgVIPJljF0WNcYMZK3XH5QGmffC4LsV0e8EdSglGdrD8SlY9akQwJhBO8N2d87i574E3ONKvbsabfgKc3SDSq500gJ96MghZ"
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId: string;
  initialCardholder?: string | null;
  initialZip?: string | null;
  existingLastFour?: string | null;
  onAuthorized?: () => void;
}

export function CCAuthDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Authorize Card
          </DialogTitle>
          <DialogDescription>
            Card is saved securely via Stripe — not charged. The rental provider
            charges on pickup.
          </DialogDescription>
        </DialogHeader>
        <Elements stripe={stripePromise}>
          <CCAuthForm {...props} />
        </Elements>
      </DialogContent>
    </Dialog>
  );
}

function CCAuthForm({
  rentalId,
  initialCardholder,
  initialZip,
  existingLastFour,
  onOpenChange,
  onAuthorized,
}: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [cardholder, setCardholder] = useState(initialCardholder ?? "");
  const [zip, setZip] = useState(initialZip ?? "");
  const [submitting, setSubmitting] = useState(false);
  const hasExistingCard = !!existingLastFour;

  async function handleAuthorize() {
    if (!cardholder.trim()) {
      toast({ title: "Cardholder name required", variant: "destructive" });
      return;
    }
    if (!zip.trim()) {
      toast({ title: "Billing ZIP required", variant: "destructive" });
      return;
    }
    if (!hasExistingCard && (!stripe || !elements)) {
      toast({ title: "Stripe not loaded yet", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const patch: Record<string, unknown> = {
        cc_auth_cardholder_name: cardholder.trim(),
        cc_auth_billing_zip: zip.trim(),
        cc_authorized: true,
        cc_authorized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!hasExistingCard) {
        const card = elements!.getElement(CardElement);
        if (!card) throw new Error("Card element not found");

        const { paymentMethod, error } = await stripe!.createPaymentMethod({
          type: "card",
          card,
          billing_details: {
            name: cardholder.trim(),
            address: { postal_code: zip.trim() },
          },
        });
        if (error) throw new Error(error.message);
        if (!paymentMethod) throw new Error("No payment method returned");

        patch.cc_auth_stripe_pm_id = paymentMethod.id;
        patch.cc_auth_last_four = paymentMethod.card?.last4 ?? null;
        patch.cc_auth_exp_month = paymentMethod.card?.exp_month ?? null;
        patch.cc_auth_exp_year = paymentMethod.card?.exp_year ?? null;
      }

      const { error: updErr } = await supabase
        .from("car_rental_requests")
        .update(patch as any)
        .eq("id", rentalId);
      if (updErr) throw updErr;

      toast({ title: "Card authorized" });
      onAuthorized?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Authorization failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cc-cardholder">Cardholder Name</Label>
        <Input
          id="cc-cardholder"
          value={cardholder}
          onChange={(e) => setCardholder(e.target.value)}
          placeholder="Name as it appears on card"
        />
      </div>

      {hasExistingCard ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Card on file: <span className="font-mono">••••{existingLastFour}</span>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Card Details</Label>
          <div className="rounded-md border px-3 py-3">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: "15px",
                    color: "hsl(var(--foreground))",
                    "::placeholder": { color: "hsl(var(--muted-foreground))" },
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="cc-zip">Billing ZIP</Label>
        <Input
          id="cc-zip"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="ZIP / postal code"
          maxLength={12}
        />
      </div>

      <DialogFooter>
        <Button
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button onClick={handleAuthorize} disabled={submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4 mr-1" />
          )}
          Authorize Card
        </Button>
      </DialogFooter>
    </div>
  );
}