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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { rentalId } = await req.json();
    if (!rentalId) {
      return json({ error: "rentalId required" }, 400);
    }

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
    if (rental.quoted_price == null) return json({ error: "No quoted price saved" }, 400);

    const confirmUrl = `${RENTAL_PUBLIC_BASE}/rental-confirm?id=${rental.id}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#0a2540">Your Car Rental Quote</h2>
        <p>Hi ${escapeHtml(rental.driver_name)},</p>
        <p>Here's the quote we put together for your rental:</p>
        ${rentalSummaryHtml(rental)}
        <p style="font-size:18px;margin:20px 0">
          <strong>Quoted Total: $${Number(rental.quoted_price).toFixed(2)}</strong>
        </p>
        <p>
          <a href="${confirmUrl}"
             style="display:inline-block;background:#c9a84c;color:#0a2540;
                    padding:12px 22px;border-radius:6px;text-decoration:none;
                    font-weight:600">
            Confirm This Quote
          </a>
        </p>
        <p style="font-size:13px;color:#555">
          Questions? Call your Crestwell agent at <strong>${RENTAL_AGENT_PHONE}</strong>.
        </p>
      </div>`;

    const send = await sendResendEmail({
      to: rental.driver_email,
      subject: `Your Crestwell Car Rental Quote — $${Number(rental.quoted_price).toFixed(2)}`,
      html,
    });
    if (!send.ok) return json({ error: send.error }, 502);

    await supabase
      .from("car_rental_requests")
      .update({
        quote_sent_at: new Date().toISOString(),
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", rental.id);

    return json({ success: true });
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