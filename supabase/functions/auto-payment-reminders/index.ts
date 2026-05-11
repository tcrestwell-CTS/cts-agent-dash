import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-secret",
};

const SITE_URL = "https://crestwellgetaways.com";
const PAY_PATH = "/payment";

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}
function encodePayload(payload: Record<string, string>): string {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

/** Schedule windows in days-until-due. Negative = overdue. */
function milestoneFor(paymentType: string | null, daysUntil: number): string | null {
  const type = (paymentType || "").toLowerCase();
  const isFinal = ["final", "final_balance", "final_payment", "balance_due"].includes(type);
  const isDeposit = type === "deposit";

  // Upcoming windows
  if (isFinal) {
    if (daysUntil === 30) return "T-30";
    if (daysUntil === 14) return "T-14";
    if (daysUntil === 7) return "T-7";
    if (daysUntil === 1) return "T-1";
  } else if (isDeposit) {
    if (daysUntil === 3) return "T-3";
    if (daysUntil === 1) return "T-1";
  } else {
    // installment / payment / other
    if (daysUntil === 14) return "T-14";
    if (daysUntil === 3) return "T-3";
  }

  // Overdue cadence: day 0, then every 3 days up to -21
  if (daysUntil === 0) return "DUE-TODAY";
  if (daysUntil < 0 && daysUntil >= -21 && daysUntil % 3 === 0) return `OVERDUE-${Math.abs(daysUntil)}`;

  return null;
}

function buildHtml(opts: {
  brand: any;
  clientName: string;
  tripName: string;
  destination: string | null;
  reminderType: string;
  amountDue: number;
  dueDate: string | null;
  isOverdue: boolean;
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

  const intro = opts.isOverdue
    ? `Our records show your <strong>${opts.reminderType}</strong> of <strong>${fmt(opts.amountDue)}</strong> for <strong>${opts.tripName}</strong> was due on <strong>${fmtDate(opts.dueDate)}</strong> and is now past due. Please submit payment at your earliest convenience to keep your booking secure.`
    : `This is a friendly reminder that your <strong>${opts.reminderType}</strong> of <strong>${fmt(opts.amountDue)}</strong> for <strong>${opts.tripName}</strong> is due on <strong>${fmtDate(opts.dueDate)}</strong>.`;

  const badgeText = opts.isOverdue ? "Past Due" : "Payment Reminder";

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;">
    <div style="background:${navy};padding:28px 24px;text-align:center;border-radius:8px 8px 0 0;">
      ${logo ? `<img src="${logo}" alt="${agencyName}" style="max-height:54px;margin-bottom:10px;"/>` : ""}
      <div style="color:${gold};font-family:Georgia,serif;font-size:22px;font-weight:600;letter-spacing:0.5px;">${agencyName}</div>
      <div style="color:#ffffff;opacity:0.75;font-size:12px;margin-top:4px;font-style:italic;">${tagline}</div>
    </div>
    <div style="padding:28px 28px 8px;">
      <div style="display:inline-block;background:${gold};color:${navy};padding:6px 14px;border-radius:4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${badgeText}</div>
      <h2 style="color:${navy};margin:18px 0 6px;font-family:Georgia,serif;">${opts.reminderType} ${opts.isOverdue ? "Past Due" : "Due " + fmtDate(opts.dueDate)}</h2>
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: shared agent secret OR service role bearer (cron uses service role)
    const agentSecret = req.headers.get("x-agent-secret");
    const authHeader = req.headers.get("Authorization") || "";
    const expectedSecret = Deno.env.get("CW_AGENT_SECRET");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bearerOk = authHeader === `Bearer ${serviceKey}`;
    const secretOk = !!expectedSecret && agentSecret === expectedSecret;
    if (!bearerOk && !secretOk) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // Optional dry-run via query param
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "1";

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const inDays = (n: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const minDate = inDays(-21);
    const maxDate = inDays(30);

    // Pull candidate trip_payments in the relevant window
    const { data: candidates, error: tpErr } = await supabase
      .from("trip_payments")
      .select("id, trip_id, user_id, amount, due_date, payment_type, status")
      .neq("status", "paid")
      .neq("status", "cancelled")
      .not("due_date", "is", null)
      .gte("due_date", minDate)
      .lte("due_date", maxDate);

    if (tpErr) throw tpErr;

    const { data: brandingRow } = await supabase
      .from("branding_settings").select("*").limit(1).maybeSingle();
    const resend = new Resend(RESEND_API_KEY);

    const results: any[] = [];
    let sent = 0, skipped = 0, failed = 0;

    for (const tp of candidates || []) {
      try {
        const due = new Date(`${tp.due_date}T00:00:00Z`);
        const daysUntil = Math.round((due.getTime() - today.getTime()) / 86400000);
        const milestone = milestoneFor(tp.payment_type, daysUntil);
        if (!milestone) { skipped++; continue; }

        // Dedup: skip if we've already auto-sent this milestone for this trip_payment
        const { data: existing } = await supabase
          .from("invoice_email_log")
          .select("id")
          .eq("qbo_invoice_id", `TP-${tp.id}`)
          .eq("email_kind", "auto")
          .contains("meta", { milestone })
          .limit(1);
        if (existing && existing.length > 0) { skipped++; continue; }

        const { data: trip } = await supabase
          .from("trips").select("id, trip_name, destination, client_id")
          .eq("id", tp.trip_id).maybeSingle();
        if (!trip) { skipped++; continue; }

        const { data: client } = await supabase
          .from("clients").select("id, name, email")
          .eq("id", trip.client_id).maybeSingle();
        if (!client?.email) { skipped++; continue; }

        const reminderType = reminderTypeLabel(tp.payment_type);
        const amount = Number(tp.amount || 0);
        const isOverdue = daysUntil < 0 || milestone === "DUE-TODAY";

        // Mint pay link
        let payUrl = `${SITE_URL}${PAY_PATH}`;
        try {
          const tk = generateToken();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          const ref = `TP-${tp.id.slice(0, 8).toUpperCase()}`;
          const { error: linkErr } = await supabase.from("secure_links").insert({
            token: tk, link_type: "payment",
            client_name: client.name, client_email: client.email,
            booking_ref: ref, trip_name: trip.trip_name, amount,
            notes: `Automatic payment reminder (${reminderType}, ${milestone})`,
            expires_at: expiresAt, single_use: false, active: true,
          });
          if (!linkErr) {
            payUrl = `${SITE_URL}${PAY_PATH}?d=${encodePayload({
              token: tk, ref, name: client.name, email: client.email,
            })}`;
          }
        } catch (e) { console.error("secure_link mint failed:", e); }

        const subject = isOverdue
          ? `Past Due — ${reminderType} of ${fmt(amount)} (was due ${fmtDate(tp.due_date)})`
          : `Payment Reminder — ${reminderType} of ${fmt(amount)} due ${fmtDate(tp.due_date)}`;

        const html = buildHtml({
          brand: brandingRow,
          clientName: client.name,
          tripName: trip.trip_name || "your trip",
          destination: trip.destination,
          reminderType, amountDue: amount, dueDate: tp.due_date,
          isOverdue, payUrl,
        });

        if (dryRun) {
          results.push({ trip_payment_id: tp.id, milestone, recipient: client.email, would_send: true });
          continue;
        }

        const sendResp = await resend.emails.send({
          from: `${brandingRow?.agency_name || "Crestwell Travel Services"} <noreply@crestwellgetaways.com>`,
          to: [client.email], subject, html,
          replyTo: brandingRow?.email_address || "info@crestwellgetaways.com",
        });
        const sendError = (sendResp as any)?.error;
        const providerId = (sendResp as any)?.data?.id || null;

        await supabase.from("invoice_email_log").insert({
          qbo_invoice_id: `TP-${tp.id}`,
          trip_id: trip.id, client_id: client.id,
          recipient_email: client.email,
          email_kind: "auto",
          resend_id: providerId,
          due_date: tp.due_date, amount,
          meta: {
            source: "auto-payment-reminders",
            trip_payment_id: tp.id,
            payment_type: tp.payment_type,
            milestone,
            days_until: daysUntil,
            is_overdue: isOverdue,
            subject,
            error: sendError ? String(sendError?.message || sendError) : null,
          },
        });

        await supabase.from("email_logs").insert({
          client_id: client.id, to_email: client.email, subject,
          template: "payment_reminder_auto",
          status: sendError ? "failed" : "sent",
          provider_message_id: providerId,
          error_message: sendError ? String(sendError?.message || sendError) : null,
          idempotency_key: `tp-auto-${tp.id}-${milestone}`,
          metadata: {
            source: "auto-payment-reminders",
            trip_payment_id: tp.id, trip_id: trip.id,
            amount, due_date: tp.due_date,
            reminder_type: reminderType, milestone, days_until: daysUntil,
          },
        });

        if (sendError) { failed++; results.push({ trip_payment_id: tp.id, milestone, error: String(sendError?.message || sendError) }); }
        else { sent++; results.push({ trip_payment_id: tp.id, milestone, recipient: client.email, sent: true }); }
      } catch (inner) {
        failed++;
        console.error("auto-reminder failed for", tp.id, inner);
        results.push({ trip_payment_id: tp.id, error: inner instanceof Error ? inner.message : String(inner) });
      }
    }

    return new Response(JSON.stringify({
      ok: true, dry_run: dryRun,
      candidates: (candidates || []).length,
      sent, skipped, failed, results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("auto-payment-reminders error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});