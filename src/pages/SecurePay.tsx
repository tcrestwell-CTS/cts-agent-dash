import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ShieldCheck, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
    "pk_live_51RrgVIPJljF0WNcYMZK3XH5QGmffC4LsV0e8EdSglGdrD8SlY9akQwJhBO8N2d87i574E3ONKvbsabfgKc3SDSq500gJ96MghZ"
);

interface LinkData {
  client_name: string | null;
  client_email: string | null;
  booking_ref: string | null;
  trip_name: string | null;
  amount: number | null;
  agent_user_id: string | null;
  trip_payment_id: string | null;
}

interface Branding {
  full_name: string | null;
  agency_name: string | null;
  storefront_logo_url: string | null;
}

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

/** Decode the base64url `d` payload used by branded payment/reminder emails. */
function decodePayload(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const d = params.get("d");
  if (d) {
    try {
      const b64 = d.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      const parsed = JSON.parse(atob(padded));
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* fall through to plain query params */
    }
  }
  const out: Record<string, string> = {};
  params.forEach((v, k) => (out[k] = v));
  return out;
}

function slugFromHost() {
  const host = window.location.hostname;
  if (!host.endsWith("crestwelltravels.com")) return null;
  const parts = host.split(".");
  if (parts.length < 3) return null;
  const sub = parts[0].toLowerCase();
  return ["www", "app", "compass", "id-preview"].includes(sub) ? null : sub;
}

function PayForm({
  onPaid,
  amount,
  name,
  email,
}: {
  onPaid: () => void;
  amount: number;
  name?: string | null;
  email?: string | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [slowLoad, setSlowLoad] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlowLoad(true), 8000);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Payment could not be completed");
      return;
    }
    if (paymentIntent && ["succeeded", "processing"].includes(paymentIntent.status)) {
      onPaid();
    }
  }

  const blocked = cardError || (slowLoad && !cardReady);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border bg-card p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Deposit Amount</p>
        <p className="text-3xl font-semibold">{currency(amount)}</p>
      </div>
      <PaymentElement
        options={{
          layout: "tabs",
          fields: {
            billingDetails: {
              name: "auto",
              email: "auto",
              address: { country: "auto", postalCode: "auto" },
            },
          },
          defaultValues: {
            billingDetails: {
              name: name || undefined,
              email: email || undefined,
              address: { country: "US" },
            },
          },
        }}
        onReady={() => {
          setCardReady(true);
          setCardError(null);
        }}
        onLoadError={(e) =>
          setCardError(
            e?.error?.message || "The secure card form could not be loaded."
          )
        }
      />
      {blocked ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-destructive">
            Card fields didn’t load on this browser.
          </p>
          <p>
            This usually happens inside an in-app browser (Gmail, Facebook,
            Instagram) where cookies are blocked. Tap the “…” menu and choose
            <span className="font-medium"> Open in Safari / Chrome</span>, or
            copy this link into your browser:
          </p>
          <code className="block break-all rounded bg-muted p-2">
            {window.location.href}
          </code>
        </div>
      ) : null}
      <Button
        type="submit"
        className="w-full gap-2"
        disabled={submitting || !stripe || !cardReady}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {submitting ? "Processing…" : `Pay ${currency(amount)} Securely`}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Payments are processed securely by Stripe through Crestwell Travel Network, our host agency.
      </p>
    </form>
  );
}


export default function SecurePay() {
  const payload = useMemo(() => decodePayload(window.location.search), []);
  const token = payload.token || "";
  const [loading, setLoading] = useState(true);
  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [link, setLink] = useState<LinkData | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [email, setEmail] = useState(payload.email || "");
  const [amountInput, setAmountInput] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    (async () => {
      const applyBranding = async () => {
        const slug = slugFromHost();
        if (!slug) return;
        const { data: agent } = await supabase
          .from("profiles")
          .select("full_name, agency_name, storefront_logo_url")
          .eq("storefront_slug", slug)
          .maybeSingle();
        if (agent) setBranding(agent as Branding);
      };

      if (!token) {
        // Links minted from the advisor's "Send Payment Link" flow carry the
        // CRM ids directly in the base64 payload instead of a secure_links
        // token. The amount is still re-locked server-side from
        // trip_payment_id inside create-payment-intent.
        if (payload.trip_payment_id) {
          const cents = Number(payload.amount);
          setLink({
            client_name: payload.client_name || null,
            client_email: payload.client_email || null,
            booking_ref: payload.booking_ref || null,
            trip_name: payload.trip_name || null,
            amount: Number.isFinite(cents) && cents > 0 ? cents / 100 : null,
            agent_user_id: payload.agent_user_id || null,
            trip_payment_id: payload.trip_payment_id,
          });
          setEmail((prev) => prev || payload.client_email || "");
          if (Number.isFinite(cents) && cents > 0) setAmountInput(String(cents / 100));
          await applyBranding();
          setLoading(false);
          return;
        }
        setInvalidReason("This payment link is missing its secure token.");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("validate-token", {
          body: { token, link_type: "payment" },
        });
        if (error) throw error;
        if (!data?.valid) {
          setInvalidReason(data?.reason || "This payment link is no longer valid.");
        } else {
          setLink(data as LinkData);
          setEmail((prev) => prev || data.client_email || "");
          setAmountInput(data.amount ? String(data.amount) : "");
          const slug = slugFromHost();
          if (slug) {
            const { data: agent } = await supabase
              .from("profiles")
              .select("full_name, agency_name, storefront_logo_url")
              .eq("storefront_slug", slug)
              .maybeSingle();
            if (agent) setBranding(agent as Branding);
          }
        }
      } catch (err) {
        console.error("[SecurePay] validation failed", err);
        setInvalidReason("We couldn't verify this payment link. Please contact your advisor.");
      }
      setLoading(false);
    })();
  }, [token]);

  async function startPayment() {
    const amount = parseFloat(amountInput);
    if (!amount || amount < 0.5) {
      toast.error("Enter a payment amount of at least $0.50");
      return;
    }
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment-intent", {
        body: {
          amount_cents: Math.round(amount * 100),
          customer_name: link?.client_name || payload.name || "",
          // Only send a receipt email when it actually looks like an email
          customer_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? email.trim() : "",
          booking_ref: link?.booking_ref || payload.ref || null,
          trip_name: link?.trip_name || null,
          payment_type: link?.trip_payment_id ? "trip_installment" : "deposit",
          trip_payment_id: link?.trip_payment_id || null,
          agent_user_id: link?.agent_user_id || null,
        },
      });
      if (error) throw error;
      if (!data?.clientSecret) throw new Error(data?.error || "Could not start checkout");
      const amountCents = Number(data.amountCents);
      if (!Number.isInteger(amountCents) || amountCents < 50) {
        throw new Error("The payment amount could not be verified");
      }
      setConfirmedAmount(amountCents / 100);
      setClientSecret(data.clientSecret);
    } catch (err: any) {
      console.error("[SecurePay] intent failed", err);
      toast.error(err?.message || "Could not start checkout. Please try again.");
    }
    setStarting(false);
  }

  const brandName = branding?.agency_name || branding?.full_name || "Crestwell Travel Services";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-10 w-40 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (invalidReason) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto rounded-full bg-destructive/10 p-3 w-fit">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle>Payment Link Not Valid</CardTitle>
            <CardDescription>{invalidReason}</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            Please contact your travel advisor for a new link, or call{" "}
            <span className="font-medium text-foreground">888.508.6893</span>.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Payment Received</CardTitle>
            <CardDescription>
              Thank you{link?.client_name ? `, ${link.client_name}` : ""}. A receipt is on its way to your email.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          {branding?.storefront_logo_url ? (
            <img
              src={branding.storefront_logo_url}
              alt={`${brandName} logo`}
              className="h-14 mx-auto object-contain"
            />
          ) : (
            <h1 className="text-2xl font-semibold">{brandName}</h1>
          )}
          <p className="text-sm text-muted-foreground">Secure Payment</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {link?.trip_name || "Your trip payment"}
            </CardTitle>
            <CardDescription>
              {link?.client_name ? `For ${link.client_name}` : "Complete your payment below"}
              {link?.booking_ref ? ` • Ref ${link.booking_ref}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!clientSecret ? (
              <>
                <div className="rounded-lg border bg-card p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount Due</p>
                  <p className="text-3xl font-semibold">
                    {currency(parseFloat(amountInput || "0") || 0)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Amount ($)</Label>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.01"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                     readOnly={Boolean(link?.trip_payment_id)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email for receipt</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </div>
                <Button className="w-full gap-2" onClick={startPayment} disabled={starting}>
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Continue to Payment
                </Button>
              </>
            ) : confirmedAmount !== null ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PayForm
                  amount={confirmedAmount}
                  name={link?.client_name}
                  email={email}
                  onPaid={() => setPaid(true)}
                />

              </Elements>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
