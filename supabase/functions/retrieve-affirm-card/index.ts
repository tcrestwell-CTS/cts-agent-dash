import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * retrieve-affirm-card
 *
 * Owner-only access to an Affirm Virtual Card (VCN) tied to a trip_payment.
 * Card values are returned to the browser and NEVER written to the database.
 *
 * Actions:
 *  - "reveal"   (default) → GET  /api/v2/cards/{checkout_id}          (Read Card)
 *  - "mark_used"          → sets trip_payments.virtual_card_status = "used"
 *  - "finalize"           → POST /api/v2/cards/{checkout_id}/finalize  (Finalize)
 *
 * NOTE: Affirm "Finalize" resolves the loan down to what has been captured on the
 * card — if nothing has been captured yet, the loan is VOIDED. It is therefore
 * never called on reveal, and only on explicit request.
 */

const AFFIRM_BASE = "https://api.affirm.com/api/v2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: authData } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!authData.user) return json({ error: "Not authenticated" }, 401);
    const userId = authData.user.id;

    const body = await req.json().catch(() => ({}));
    const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
    const action = body?.action ?? "reveal";
    if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return json({ error: "paymentId is required" }, 400);
    if (!["reveal", "mark_used", "finalize"].includes(action)) return json({ error: "Invalid action" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: payment, error: payErr } = await supabase
      .from("trip_payments")
      .select("id, user_id, virtual_card_id, virtual_card_status, payment_method_choice")
      .eq("id", paymentId)
      .single();

    if (payErr || !payment) return json({ error: "Payment not found" }, 404);
    if (payment.user_id !== userId) return json({ error: "Unauthorized" }, 403);
    if (payment.payment_method_choice !== "affirm") {
      return json({ error: "This payment does not have an Affirm virtual card" }, 400);
    }
    if (!payment.virtual_card_id) return json({ error: "No Affirm card associated with this payment" }, 400);

    if (action === "mark_used") {
      const { error } = await supabase
        .from("trip_payments")
        .update({ virtual_card_status: "used" })
        .eq("id", paymentId);
      if (error) throw new Error(error.message);
      return json({ success: true, virtual_card_status: "used" });
    }

    const pub = Deno.env.get("AFFIRM_PUBLIC_KEY");
    const priv = Deno.env.get("AFFIRM_PRIVATE_KEY");
    if (!pub || !priv) throw new Error("Affirm keys not configured");
    const auth = "Basic " + btoa(`${pub}:${priv}`);
    const cardId = encodeURIComponent(payment.virtual_card_id);

    if (action === "finalize") {
      const res = await fetch(`${AFFIRM_BASE}/cards/${cardId}/finalize`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: data?.message || `Affirm finalize failed (${res.status})` }, 502);
      return json({ success: true });
    }

    if (payment.virtual_card_status === "used") {
      return json({ error: "This card has been marked as used" }, 409);
    }

    const res = await fetch(`${AFFIRM_BASE}/cards/${cardId}`, {
      headers: { Authorization: auth },
    });
    const card = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Affirm read card failed:", res.status, card?.code || card?.message);
      return json({ error: card?.message || `Affirm card lookup failed (${res.status})` }, 502);
    }

    // Affirm expiration is "MMYY"
    const exp = String(card.expiration ?? "");
    const number = card.number ? String(card.number) : null;

    return json({
      number,
      cvc: card.cvv ? String(card.cvv) : null,
      exp_month: exp.length === 4 ? Number(exp.slice(0, 2)) : null,
      exp_year: exp.length === 4 ? 2000 + Number(exp.slice(2)) : null,
      cardholder_name: card.cardholder_name || null,
      brand: "Affirm VCN",
      last4: number ? number.slice(-4) : null,
      status: payment.virtual_card_status || "ready",
      spending_limit: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("retrieve-affirm-card error:", message);
    return json({ error: message }, 500);
  }
});
