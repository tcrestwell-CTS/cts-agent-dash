import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Eye, EyeOff, Loader2, Copy, CheckCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface StripeVirtualCardButtonProps {
  paymentId: string;
  amount: number;
  supplierName?: string | null;
  tripName?: string | null;
  /** 'paid' | 'confirmed' — only render when the client has paid */
  paymentStatus: string;
  /** Existing card state from DB */
  virtualCardId?: string | null;
  virtualCardStatus?: string | null;
}

interface CardDetails {
  number: string | null;
  cvc: string | null;
  exp_month: number;
  exp_year: number;
  cardholder_name: string | null;
  brand: string;
  last4: string;
  status: string;
  spending_limit: number | null;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

/** Mask all but last 4 digits of a card number */
const maskCardNumber = (num: string | null) => {
  if (!num) return "•••• •••• •••• ••••";
  const clean = num.replace(/\s/g, "");
  return clean
    .replace(/(.{4})/g, "$1 ")
    .trim()
    .replace(/^[\d ]{0,12}/, (m) => m.replace(/\d/g, "•"));
};

export function StripeVirtualCardButton({
  paymentId,
  amount,
  supplierName,
  tripName,
  paymentStatus,
  virtualCardId,
  virtualCardStatus,
}: StripeVirtualCardButtonProps) {
  const [issuing, setIssuing] = useState(false);
  const [retrieving, setRetrieving] = useState(false);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [cardDetails, setCardDetails] = useState<CardDetails | null>(null);
  const [showNumber, setShowNumber] = useState(false);
  const [showCvc, setShowCvc] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Only show for paid payments
  if (paymentStatus !== "paid") return null;

  const hasCard = !!virtualCardId && virtualCardStatus === "ready";

  // ── Issue a new card ────────────────────────────────────────────────
  const handleIssue = async () => {
    setIssuing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("create-virtual-card", {
        body: { paymentId, method: "stripe" },
      });

      if (res.error) throw new Error(res.error.message || "Failed to issue card");
      if (res.data?.error) throw new Error(res.data.error);

      toast.success(
        "Stripe virtual card issued — check your email for details, or click 'View Card' to retrieve the number.",
        { duration: 6000 }
      );
      setShowIssueDialog(false);

      // Reload page data so the card ID populates
      window.location.reload();
    } catch (err: any) {
      toast.error("Card issuance failed: " + err.message);
    } finally {
      setIssuing(false);
    }
  };

  // ── Retrieve sensitive card details ────────────────────────────────
  const handleRetrieve = async () => {
    setRetrieving(true);
    try {
      const res = await supabase.functions.invoke("retrieve-virtual-card", {
        body: { paymentId },
      });

      if (res.error) throw new Error(res.error.message || "Failed to retrieve card");
      if (res.data?.error) throw new Error(res.data.error);

      setCardDetails(res.data);
      setShowCardDialog(true);
      setShowNumber(false);
      setShowCvc(false);
    } catch (err: any) {
      toast.error("Could not retrieve card: " + err.message);
    } finally {
      setRetrieving(false);
    }
  };

  // ── Copy to clipboard ───────────────────────────────────────────────
  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Copy failed — select and copy manually.");
    }
  };

  return (
    <>
      {hasCard ? (
        // ── Already issued: show "View Card" button ────────────────
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs border-success text-success hover:bg-success/10"
          onClick={handleRetrieve}
          disabled={retrieving}
          data-testid="button-retrieve-virtual-card"
        >
          {retrieving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CreditCard className="h-3.5 w-3.5" />
          )}
          View Card
          <Badge
            variant="outline"
            className="ml-1 text-[10px] px-1 py-0 border-success text-success"
          >
            Stripe
          </Badge>
        </Button>
      ) : (
        // ── Not yet issued: show "Issue Card" button ───────────────
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowIssueDialog(true)}
          data-testid="button-issue-virtual-card"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Issue Virtual Card
        </Button>
      )}

      {/* ── Issue confirmation dialog ──────────────────────────────── */}
      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Issue Stripe Virtual Card
            </DialogTitle>
            <DialogDescription>
              A single-use Stripe Issuing virtual card will be created with a spending
              limit of{" "}
              <strong>{formatCurrency(amount)}</strong>
              {supplierName ? (
                <>
                  {" "}to pay <strong>{supplierName}</strong>
                </>
              ) : tripName ? (
                <>
                  {" "}for <strong>{tripName}</strong>
                </>
              ) : null}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-muted border p-4 text-sm space-y-2 text-muted-foreground">
            <p className="flex items-start gap-2">
              <span className="text-base leading-none">💳</span>
              Card draws from your <strong>Stripe payments balance</strong> — no bank transfer needed.
            </p>
            <p className="flex items-start gap-2">
              <span className="text-base leading-none">🔒</span>
              Spending limit is locked to exactly <strong>{formatCurrency(amount)}</strong>.
            </p>
            <p className="flex items-start gap-2">
              <span className="text-base leading-none">📧</span>
              Card details will be <strong>shown on screen and emailed</strong> to you immediately.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowIssueDialog(false)} disabled={issuing}>
              Cancel
            </Button>
            <Button onClick={handleIssue} disabled={issuing} data-testid="button-confirm-issue-card">
              {issuing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {issuing ? "Issuing…" : "Issue Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Card details dialog ────────────────────────────────────── */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-success" />
              Stripe Virtual Card
            </DialogTitle>
            <DialogDescription>
              Use these details to pay{" "}
              {supplierName ? <strong>{supplierName}</strong> : "the supplier"}.
              This card is single-use and locked to {formatCurrency(amount)}.
            </DialogDescription>
          </DialogHeader>

          {cardDetails && (
            <div className="space-y-4 mt-1">
              {/* Card visual */}
              <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 p-5 text-white font-mono shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs tracking-widest text-muted-foreground uppercase">
                    {cardDetails.brand}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      cardDetails.status === "active"
                        ? "border-success text-success text-[10px]"
                        : "border-warning text-warning text-[10px]"
                    }
                  >
                    {cardDetails.status}
                  </Badge>
                </div>

                {/* Card number row */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm tracking-widest">
                    {showNumber && cardDetails.number
                      ? cardDetails.number.replace(/(.{4})/g, "$1 ").trim()
                      : maskCardNumber(cardDetails.number)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      className="text-muted-foreground hover:text-white transition-colors p-1"
                      onClick={() => setShowNumber((v) => !v)}
                      title={showNumber ? "Hide number" : "Reveal number"}
                    >
                      {showNumber ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    {cardDetails.number && (
                      <button
                        className="text-muted-foreground hover:text-white transition-colors p-1"
                        onClick={() => copy(cardDetails.number!, "number")}
                        title="Copy card number"
                      >
                        {copied === "number" ? (
                          <CheckCheck className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expiry + CVV row */}
                <div className="flex items-end justify-between text-xs">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Expires</p>
                    <span>
                      {String(cardDetails.exp_month).padStart(2, "0")}/
                      {String(cardDetails.exp_year).slice(-2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">CVC</p>
                    <div className="flex items-center gap-1">
                      <span className="tracking-widest">
                        {showCvc && cardDetails.cvc ? cardDetails.cvc : "•••"}
                      </span>
                      <button
                        className="text-muted-foreground hover:text-white transition-colors"
                        onClick={() => setShowCvc((v) => !v)}
                        title={showCvc ? "Hide CVC" : "Reveal CVC"}
                      >
                        {showCvc ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                      {cardDetails.cvc && (
                        <button
                          className="text-muted-foreground hover:text-white transition-colors"
                          onClick={() => copy(cardDetails.cvc!, "cvc")}
                          title="Copy CVC"
                        >
                          {copied === "cvc" ? (
                            <CheckCheck className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Cardholder</p>
                    <span className="text-[11px]">{cardDetails.cardholder_name || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Spending limit */}
              {cardDetails.spending_limit !== null && (
                <div className="flex items-center justify-between text-sm px-1">
                  <span className="text-muted-foreground">Spending limit</span>
                  <span className="font-semibold text-success">
                    {formatCurrency(cardDetails.spending_limit)}
                  </span>
                </div>
              )}

              {/* Stripe dashboard link */}
              <div className="text-center">
                <a
                  href={`https://dashboard.stripe.com/issuing/cards/${virtualCardId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  View in Stripe Dashboard
                </a>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                Card details auto-expire from this view when you close this dialog.
                Use the Stripe Dashboard link above for persistent access.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
