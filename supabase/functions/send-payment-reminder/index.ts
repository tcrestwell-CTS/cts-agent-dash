import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://crestwellgetaways.com";
const PAY_PATH = "/payment";

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

function encodePayload(payload: Record<string, string>): string {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";

function reminderTypeLabel(t: string | null | undefined): string {
  switch (t) {
    case "deposit": return "Deposit";
    case "balance_due":
    case "final":
    case "final_balance":
    case "final_payment": return "Final Balance";
    case "installment": return "Installment";
    default: return "Payment";
  }
}

function buildHtml(opts: {
  brand: any;
  clientName: string;
  tripName: string;
  destination: string | null;
  reminderType: string;
  amountDue: number;
  dueDate: string | null;
  customMessage?: string | null;
  payUrl: string;
}) {
  const b = opts.brand || {};
  const navy = b.primary_color || "#0d1b2a";
  const gold = b.accent_color || "#c9a84c";
  const agencyName = b.agency_name || "Crestwell Travel Services";
  const tagline = b.tagline || "Your Journey, Our Passion";
  const phone = b.phone || "1-888-508-6893";
  const website = b.website || "https://crestwellgetaways.com";
  const emailAddr = b.email_address || "info@crestwellgetaways.com";
  const logo = b.logo_url || "";

  const intro = opts.customMessage && opts.customMessage.trim().length > 0
    ? opts.customMessage.trim().replace(/\n/g, "<br/>")
    : `This is a friendly reminder that your <strong>${opts.reminderType}</strong> of <strong>${fmt(opts.amountDue)}</strong> for <strong>${opts.tripName}</strong> is due on <strong>${fmtDate(opts.dueDate)}</strong>.`;

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;">
    <div style="background:${navy};padding:28px 24px;text-align:center;border-radius:8px 8px 0 0;">
      ${logo ? `<img src="${logo}" alt="${agencyName}" style="max-height:54px;margin-bottom:10px;"/>` : ""}
      <div style="color:${gold};font-family:Georgia,serif;font-size:22px;font-weight:600;letter-spacing:0.5px;">${agencyName}</div>
      <div style="color:#ffffff;opacity:0.75;font-size:12px;margin-top:4px;font-style:italic;">${tagline}</div>
    </div>
    <div style="padding:28px 28px 8px;">
      <div style="display:inline-block;background:${gold};color:${navy};padding:6px 14px;border-radius:4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Payment Reminder</div>
      <h2 style="color:${navy};margin:18px 0 6px;font-family:Georgia,serif;">${opts.reminderType} Due ${fmtDate(opts.dueDate)}</h2>
      <p style="color:#4b5563;margin:0 0 4px;">Hi ${opts.clientName},</p>
      <p style="color:#4b5563;line-height:1.6;margin:8px 0 18px;">${intro}</p>

      <div style="background:${navy};color:#ffffff;border-radius:8px;padding:20px;margin:18px 0;">
        <div style="color:${gold};font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Amount Due</div>
        <div style="font-size:32px;font-weight:700;font-family:Georgia,serif;">${fmt(opts.amountDue)}</div>
        <div style="margin-top:6px;opacity:0.85;font-size:13px;">Due ${fmtDate(opts.dueDate)}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:8px 0 20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Trip</td><td style="padding:12px 16px;color:${navy};font-weight:600;text-align:right;">${opts.tripName}</td></tr>
        ${opts.destination ? `<tr><td style="padding:12px 16px;color:#6b7280;font-size:13px;border-top:1px solid #e5e7eb;">Destination</td><td style="padding:12px 16px;color:#111827;text-align:right;border-top:1px solid #e5e7eb;">${opts.destination}</td></tr>` : ""}
        <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;border-top:1px solid #e5e7eb;">Reminder Type</td><td style="padding:12px 16px;color:#111827;text-align:right;border-top:1px solid #e5e7eb;">${opts.reminderType}</td></tr>
      </table>

      <div style="text-align:center;margin:28px 0;">
        <a href="${opts.payUrl}" style="background:${gold};color:${navy};padding:14px 36px;text-decoration:none;border-radius:6px;font-weight:700;display:inline-block;letter-spacing:0.5px;">Pay Online</a>
        <div style="color:#6b7280;font-size:12px;margin-top:10px;">Secure payment link</div>
        <div style="color:#9ca3af;font-size:11px;line-height:1.5;margin-top:8px;max-width:440px;margin-left:auto;margin-right:auto;">
          Payments are securely processed through Crestwell Travel Network, ${agencyName}'s host agency, so that name may appear on the checkout page and your statement.
        </div>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:20px 0 0;">
        Questions? Reply to this email or call us at <a href="tel:${phone.replace(/[^0-9]/g,'')}" style="color:${navy};">${phone}</a>.
      </p>
    </div>
    <div style="background:#f9fafb;padding:18px 24px;text-align:center;color:#6b7280;font-size:12px;border-top:3px solid ${gold};border-radius:0 0 8px 8px;">
      <div style="color:${navy};font-weight:600;margin-bottom:4px;">${agencyName}</div>
      <div>${emailAddr} • ${phone}</div>
      <div style="margin-top:4px;"><a href="${website}" style="color:${navy};text-decoration:none;">${website}</a></div>
    </div>
  </div>`;
}

interface ReqBody {
  trip_payment_id: string;
  custom_subject?: string;
  custom_message?: string;
  preview?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;
    const userEmail = (claims.claims.email as string) || "";

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body: ReqBody = await req.json();
    if (!body?.trip_payment_id) {
      return new Response(JSON.stringify({ error: "trip_payment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tp, error: tpErr } = await supabase
      .from("trip_payments")
      .select("id, trip_id, user_id, amount, due_date, payment_type, status")
      .eq("id", body.trip_payment_id)
      .maybeSingle();
    if (tpErr || !tp) throw new Error("Trip payment not found");

    // Authorization: owner OR admin/office_admin
    if (tp.user_id !== userId) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const roles = (roleRows || []).map((r: any) => r.role);
      if (!roles.includes("admin") && !roles.includes("office_admin")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: trip } = await supabase
      .from("trips")
      .select("id, trip_name, destination, client_id")
      .eq("id", tp.trip_id)
      .maybeSingle();
    if (!trip) throw new Error("Trip not found");

    const { data: client } = await supabase
      .from("clients")
      .select("id, name, email")
      .eq("id", trip.client_id)
      .maybeSingle();
    if (!client?.email) throw new Error("Client has no email on file");

    const { data: brandingRow } = await supabase
      .from("branding_settings").select("*").limit(1).maybeSingle();

    const reminderType = reminderTypeLabel(tp.payment_type);
    const amount = Number(tp.amount || 0);
    const dueDate = tp.due_date as string | null;
    const subject = (body.custom_subject?.trim() ||
      `Payment Reminder — ${reminderType} of ${fmt(amount)} due ${fmtDate(dueDate)}`);

    // Mint secure pay link
    let payUrl = `${SITE_URL}${PAY_PATH}`;
    try {
      const tk = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const ref = `TP-${tp.id.slice(0, 8).toUpperCase()}`;
      const { error: linkErr } = await supabase.from("secure_links").insert({
        token: tk,
        link_type: "payment",
        client_name: client.name,
        client_email: client.email,
        booking_ref: ref,
        trip_name: trip.trip_name,
        amount,
        notes: `Manual payment reminder (${reminderType})`,
        expires_at: expiresAt,
        single_use: false,
        active: true,
      });
      if (!linkErr) {
        payUrl = `${SITE_URL}${PAY_PATH}?d=${encodePayload({
          token: tk, ref, name: client.name, email: client.email,
        })}`;
      }
    } catch (e) {
      console.error("secure_link mint failed:", e);
    }

    const html = buildHtml({
      brand: brandingRow,
      clientName: client.name,
      tripName: trip.trip_name || "your trip",
      destination: trip.destination,
      reminderType,
      amountDue: amount,
      dueDate,
      customMessage: body.custom_message,
      payUrl,
    });

    if (body.preview) {
      return new Response(JSON.stringify({ ok: true, preview: true, subject, html, recipient: client.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(RESEND_API_KEY);
    const sendResp = await resend.emails.send({
      from: `${brandingRow?.agency_name || "Crestwell Travel Services"} <noreply@crestwellgetaways.com>`,
      to: [client.email],
      subject,
      html,
      replyTo: brandingRow?.email_address || "info@crestwellgetaways.com",
    });

    const sendError = (sendResp as any)?.error;
    const providerId = (sendResp as any)?.data?.id || null;

    // Log to invoice_email_log so existing dashboards pick it up
    await supabase.from("invoice_email_log").insert({
      qbo_invoice_id: `TP-${tp.id}`,
      trip_id: trip.id,
      client_id: client.id,
      recipient_email: client.email,
      email_kind: "manual",
      resend_id: providerId,
      due_date: dueDate,
      amount,
      meta: {
        source: "send-payment-reminder",
        trip_payment_id: tp.id,
        payment_type: tp.payment_type,
        sent_by_user_id: userId,
        sent_by_email: userEmail,
        subject,
      },
    });

    // Mirror to email_logs for the Email Activity dashboard
    await supabase.from("email_logs").insert({
      client_id: client.id,
      to_email: client.email,
      subject,
      template: "payment_reminder",
      status: sendError ? "failed" : "sent",
      provider_message_id: providerId,
      error_message: sendError ? String(sendError?.message || sendError) : null,
      idempotency_key: `tp-reminder-${tp.id}-${Date.now()}`,
      metadata: {
        source: "send-payment-reminder",
        trip_payment_id: tp.id,
        trip_id: trip.id,
        amount,
        due_date: dueDate,
        reminder_type: reminderType,
        sent_by: userEmail,
      },
    });

    if (sendError) {
      return new Response(JSON.stringify({ error: String(sendError?.message || sendError) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      sent: true,
      recipient: client.email,
      subject,
      sent_at: new Date().toISOString(),
      resend_id: providerId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-payment-reminder error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});