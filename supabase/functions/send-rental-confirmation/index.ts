import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  RENTAL_AGENT_PHONE,
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

    const total =
      rental.actual_total != null
        ? Number(rental.actual_total).toFixed(2)
        : rental.quoted_price != null
        ? Number(rental.quoted_price).toFixed(2)
        : null;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <h2 style="color:#0a2540">Your Rental is Confirmed</h2>
        <p>Hi ${escapeHtml(rental.driver_name)},</p>
        <p>Your car rental has been booked. Here are your details:</p>
        ${rentalSummaryHtml(rental)}
        <table style="border-collapse:collapse;font-size:14px;margin-top:12px">
          <tr><td><strong>Confirmation #:</strong></td><td>${escapeHtml(rental.confirmation_number || "—")}</td></tr>
          ${total ? `<tr><td><strong>Total:</strong></td><td>$${total}</td></tr>` : ""}
        </table>
        <p style="margin-top:16px">Present this confirmation number at the rental counter on pickup.</p>
        <p style="font-size:13px;color:#555">
          Questions? Call your Crestwell agent at <strong>${RENTAL_AGENT_PHONE}</strong>.
        </p>
      </div>`;

    const send = await sendResendEmail({
      to: rental.driver_email,
      subject: `Rental Confirmed — ${rental.confirmation_number || rental.provider}`,
      html,
    });
    if (!send.ok) return json({ error: send.error }, 502);

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