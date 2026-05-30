// Shared fire-and-forget IP/audit logger for payment-touching edge functions.
// Never throws; never awaited in the critical path.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PaymentOutcome = "attempted" | "succeeded" | "failed" | "blocked";

export interface PaymentLogEntry {
  page: string;
  outcome: PaymentOutcome;
  amount_cents?: number | null;
  currency?: string | null;
  stripe_pm_id?: string | null; // alias for stripe_payment_method_id
  stripe_payment_method_id?: string | null;
  stripe_payment_intent_id?: string | null;
  last_four?: string | null;
  client_id?: string | null;
  booking_id?: string | null;
  trip_id?: string | null;
  checkout_payment_id?: string | null;
  customer_email?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function extractClientIp(req: Request): string | null {
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return null;
}

export function extractClientCountry(req: Request): string | null {
  const h = req.headers;
  return (
    h.get("cf-ipcountry") ||
    h.get("x-vercel-ip-country") ||
    h.get("x-country-code") ||
    null
  );
}

/**
 * Fire-and-forget. Returns a Promise that always resolves (never rejects).
 * Callers should NOT await this in any latency-critical path.
 */
export function logPaymentAttempt(
  req: Request | null,
  entry: PaymentLogEntry,
): Promise<void> {
  return (async () => {
    try {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !key) return;

      const ip = req ? extractClientIp(req) : null;
      const country = req ? extractClientCountry(req) : null;
      const ua = req ? req.headers.get("user-agent") : null;

      const supabase = createClient(url, key, {
        auth: { persistSession: false },
      });

      await supabase.from("payment_ip_logs").insert({
        page: entry.page,
        outcome: entry.outcome,
        ip_address: ip,
        user_agent: ua,
        country,
        amount_cents: entry.amount_cents ?? null,
        currency: entry.currency ?? "usd",
        stripe_payment_method_id:
          entry.stripe_payment_method_id ?? entry.stripe_pm_id ?? null,
        stripe_payment_intent_id: entry.stripe_payment_intent_id ?? null,
        last_four: entry.last_four ?? null,
        client_id: entry.client_id ?? null,
        booking_id: entry.booking_id ?? null,
        trip_id: entry.trip_id ?? null,
        checkout_payment_id: entry.checkout_payment_id ?? null,
        customer_email: entry.customer_email ?? null,
        metadata: entry.metadata ?? null,
      });
    } catch (err) {
      // Swallow; this is a best-effort audit trail.
      console.warn("[payment-ip-log] insert failed:", (err as Error)?.message);
    }
  })();
}