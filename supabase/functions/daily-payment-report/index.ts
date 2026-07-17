import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RECIPIENTS = [
  "tcrestwell@crestwellgetaways.com",
  "bookkeepingredclay@gmail.com",
];

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Parse body (optional)
    let body: { date?: string; sendEmail?: boolean } = {};
    try {
      body = await req.json();
    } catch (_) { /* no body */ }

    // Default: yesterday (Eastern reporting day)
    const target = body.date
      ? body.date
      : new Date(Date.now() - 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

    // Pull all Stripe payments marked paid on the target date
    const { data: payments, error } = await supabase
      .from("trip_payments")
      .select(
        "id, amount, payment_type, payment_date, stripe_payment_intent_id, stripe_receipt_url, trip_id, trips:trip_id(trip_name, destination, client_id, clients:client_id(name, email))",
      )
      .eq("payment_method", "stripe")
      .eq("status", "paid")
      .eq("payment_date", target)
      .order("amount", { ascending: false });

    if (error) throw error;

    // Group by client
    type Row = {
      clientName: string;
      clientEmail: string | null;
      total: number;
      count: number;
      items: Array<{
        amount: number;
        type: string;
        trip: string;
        destination: string | null;
        receiptUrl: string | null;
      }>;
    };
    const groups = new Map<string, Row>();
    let grandTotal = 0;

    for (const p of payments ?? []) {
      const trip: any = (p as any).trips;
      const client: any = trip?.clients;
      const name = client?.name || "Unknown client";
      const email = client?.email || null;
      const key = `${name}|${email ?? ""}`;
      const amt = Number(p.amount) || 0;
      grandTotal += amt;
      const g = groups.get(key) ?? {
        clientName: name,
        clientEmail: email,
        total: 0,
        count: 0,
        items: [],
      };
      g.total += amt;
      g.count += 1;
      g.items.push({
        amount: amt,
        type: p.payment_type || "payment",
        trip: trip?.trip_name || "—",
        destination: trip?.destination ?? null,
        receiptUrl: (p as any).stripe_receipt_url ?? null,
      });
      groups.set(key, g);
    }

    const clients = Array.from(groups.values()).sort(
      (a, b) => b.total - a.total,
    );

    const summary = {
      date: target,
      grandTotal,
      paymentCount: payments?.length ?? 0,
      clientCount: clients.length,
      clients,
    };

    // Send email unless caller asked JSON only
    const shouldSend = body.sendEmail !== false;
    if (shouldSend) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        const displayDate = new Date(target + "T12:00:00").toLocaleDateString(
          "en-US",
          { weekday: "long", year: "numeric", month: "long", day: "numeric" },
        );

        const rowsHtml = clients.length === 0
          ? `<tr><td colspan="3" style="padding:16px;text-align:center;color:#6b7280;">No Stripe payments received on this date.</td></tr>`
          : clients.map((c) => `
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:12px 8px;vertical-align:top;">
                  <div style="font-weight:600;color:#111827;">${c.clientName}</div>
                  ${c.clientEmail ? `<div style="font-size:12px;color:#6b7280;">${c.clientEmail}</div>` : ""}
                </td>
                <td style="padding:12px 8px;vertical-align:top;font-size:13px;color:#374151;">
                  ${c.items.map((i) => `
                    <div style="margin-bottom:4px;">
                      <strong>${fmtMoney(i.amount)}</strong> · ${i.type}<br/>
                      <span style="color:#6b7280;">${i.trip}${i.destination ? ` — ${i.destination}` : ""}</span>
                      ${i.receiptUrl ? ` · <a href="${i.receiptUrl}" style="color:#0D7377;">receipt</a>` : ""}
                    </div>
                  `).join("")}
                </td>
                <td style="padding:12px 8px;text-align:right;font-weight:600;color:#065f46;white-space:nowrap;">
                  ${fmtMoney(c.total)}
                </td>
              </tr>
            `).join("");

        const html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:0 auto;padding:24px;">
            <h1 style="color:#0D7377;margin:0 0 4px 0;">Daily Payment Report</h1>
            <p style="color:#6b7280;margin:0 0 16px 0;">${displayDate}</p>
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:20px;">
              <div style="font-size:12px;color:#065f46;text-transform:uppercase;letter-spacing:0.05em;">Total Collected</div>
              <div style="font-size:28px;font-weight:700;color:#065f46;">${fmtMoney(grandTotal)}</div>
              <div style="font-size:13px;color:#065f46;margin-top:4px;">
                ${summary.paymentCount} payment${summary.paymentCount === 1 ? "" : "s"} from ${summary.clientCount} client${summary.clientCount === 1 ? "" : "s"}
              </div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr style="background:#f9fafb;text-align:left;">
                  <th style="padding:10px 8px;color:#374151;">Client</th>
                  <th style="padding:10px 8px;color:#374151;">Payments</th>
                  <th style="padding:10px 8px;color:#374151;text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            <p style="margin-top:24px;font-size:13px;color:#6b7280;">
              View full history at
              <a href="https://app.crestwelltravels.com/reports/daily-payments" style="color:#0D7377;">app.crestwelltravels.com/reports/daily-payments</a>
            </p>
          </div>
        `;

        try {
          const resend = new Resend(RESEND_API_KEY);
          await resend.emails.send({
            from: "Crestwell Travel <send@crestwellgetaways.com>",
            to: RECIPIENTS,
            subject: `Daily Payment Report — ${displayDate} · ${fmtMoney(grandTotal)}`,
            html,
          });
          await supabase.from("email_logs").insert({
            to_email: RECIPIENTS.join(","),
            subject: `Daily Payment Report — ${target}`,
            template: "daily_payment_report",
            status: "sent",
          });
        } catch (e) {
          console.error("Email send failed:", e);
        }
      } else {
        console.log("RESEND_API_KEY not set; skipping email");
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("daily-payment-report error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});