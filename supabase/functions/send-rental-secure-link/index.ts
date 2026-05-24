import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  RENTAL_AGENT_PHONE,
  RENTAL_PUBLIC_BASE,
  escapeHtml,
  rentalSummaryHtml,
  sendResendEmail,
} from "../_shared/rentalEmail.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { rentalId } = await req.json();
    if (!rentalId) return json({ error: "rentalId required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: rental, error } = await supabase
      .from("car_rental_requests")
      .select("*")
      .eq("id", rentalId)
      .single();
    if (error || !rental) return json({ error: "Rental not found" }, 404);
    if (!rental.driver_email) return json({ error: "No driver email" }, 400);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: tokenErr } = await supabase
      .from("rental_payment_tokens")
      .insert({
        rental_id: rental.id,
        token,
        expires_at: expiresAt,
      });
    if (tokenErr) return json({ error: tokenErr.message }, 500);

    const link = `${RENTAL_PUBLIC_BASE}/rental-payment?token=${token}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#0a2540">Secure Card Collection</h2>
        <p>Hi ${escapeHtml(rental.driver_name)},</p>
        <p>To finalize your rental reservation, please submit your card details securely
           using the link below. Your card details are stored by Stripe, not by us.</p>
        ${rentalSummaryHtml(rental)}
        <p style="margin:20px 0">
          <a href="${link}"
             style="display:inline-block;background:#0a2540;color:#fff;
                    padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600">
            Enter Card Details Securely
          </a>
        </p>
        <p style="font-size:12px;color:#777">
          This single-use link expires in 24 hours.
        </p>
        <p style="font-size:13px;color:#555">
          Questions? Call your Crestwell agent at <strong>${RENTAL_AGENT_PHONE}</strong>.
        </p>
      </div>`;

    const send = await sendResendEmail({
      to: rental.driver_email,
      subject: "Action required: Secure card collection for your rental",
      html,
    });
    if (!send.ok) return json({ error: send.error }, 502);

    return json({ success: true, token, link, expires_at: expiresAt });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}