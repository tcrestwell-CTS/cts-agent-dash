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
const GENERIC_PAY_URL = `${SITE_URL}${PAY_PATH}`;

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

function encodePayload(payload: Record<string, string>): string {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

interface ReqBody {
  qbo_invoice_id?: string;        // single invoice (test/manual)
  trip_id?: string;               // optionally limit to one trip
  email_kind?: "initial" | "reminder_7d" | "test" | "manual";
  test_recipient?: string;        // override recipient (test mode)
  dry_run?: boolean;              // run scheduler logic w/o sending
  reminder_days_before?: number;  // default 7
  send_initial_for_new?: boolean; // default true (cron)
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";

function buildHtml(opts: {
  brand: any;
  clientName: string;
  tripName: string;
  destination: string | null;
  invoiceNumber: string;
  qboInvoiceId: string;
  amountDue: number;
  dueDate: string | null;
  openingBalance: number;
  totalRemaining: number;
  lastPaymentAmount: number | null;
  lastPaymentDate: string | null;
  isReminder: boolean;
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
  const headline = opts.isReminder ? "Friendly Payment Reminder" : "New Invoice — Payment Schedule";

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;">
    <div style="background:${navy};padding:28px 24px;text-align:center;border-radius:8px 8px 0 0;">
      ${logo ? `<img src="${logo}" alt="${agencyName}" style="max-height:54px;margin-bottom:10px;"/>` : ""}
      <div style="color:${gold};font-family:Georgia,serif;font-size:22px;font-weight:600;letter-spacing:0.5px;">${agencyName}</div>
      <div style="color:#ffffff;opacity:0.75;font-size:12px;margin-top:4px;font-style:italic;">${tagline}</div>
    </div>
    <div style="padding:28px 28px 8px;">
      <div style="display:inline-block;background:${gold};color:${navy};padding:6px 14px;border-radius:4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${headline}</div>
      <h2 style="color:${navy};margin:18px 0 6px;font-family:Georgia,serif;">Invoice ${opts.invoiceNumber}</h2>
      <p style="color:#4b5563;margin:0 0 4px;">Dear ${opts.clientName},</p>
      <p style="color:#4b5563;line-height:1.6;margin:8px 0 18px;">
        ${opts.isReminder
          ? `This is a courtesy reminder that the following installment for <strong>${opts.tripName}</strong> is due in approximately 7 days.`
          : `Below is your latest invoice and payment schedule details for <strong>${opts.tripName}</strong>.`}
      </p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;">Trip</td><td style="padding:12px 16px;color:${navy};font-weight:600;text-align:right;">${opts.tripName}</td></tr>
        ${opts.destination ? `<tr><td style="padding:12px 16px;color:#6b7280;font-size:13px;border-top:1px solid #e5e7eb;">Destination</td><td style="padding:12px 16px;color:#111827;text-align:right;border-top:1px solid #e5e7eb;">${opts.destination}</td></tr>` : ""}
        <tr style="background:#f9fafb;"><td style="padding:12px 16px;color:#6b7280;font-size:13px;border-top:1px solid #e5e7eb;">Invoice #</td><td style="padding:12px 16px;color:#111827;text-align:right;border-top:1px solid #e5e7eb;font-family:monospace;">${opts.invoiceNumber}</td></tr>
      </table>

      <div style="background:${navy};color:#ffffff;border-radius:8px;padding:20px;margin:18px 0;">
        <div style="color:${gold};font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Amount Due</div>
        <div style="font-size:32px;font-weight:700;font-family:Georgia,serif;">${fmt(opts.amountDue)}</div>
        <div style="margin-top:6px;opacity:0.85;font-size:13px;">Due ${fmtDate(opts.dueDate)}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:8px 0 20px;">
        <tr>
          <td style="padding:10px 0;color:#6b7280;font-size:13px;">Opening balance (trip total)</td>
          <td style="padding:10px 0;color:${navy};text-align:right;font-weight:600;">${fmt(opts.openingBalance)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#6b7280;font-size:13px;border-top:1px solid #e5e7eb;">Last payment received</td>
          <td style="padding:10px 0;color:#111827;text-align:right;border-top:1px solid #e5e7eb;">
            ${opts.lastPaymentAmount != null ? `${fmt(opts.lastPaymentAmount)} <span style="color:#6b7280;font-size:12px;">on ${fmtDate(opts.lastPaymentDate)}</span>` : '<span style="color:#9ca3af;">None yet</span>'}
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#6b7280;font-size:13px;border-top:1px solid #e5e7eb;">Total remaining on trip</td>
          <td style="padding:10px 0;color:${navy};text-align:right;font-weight:700;border-top:1px solid #e5e7eb;">${fmt(opts.totalRemaining)}</td>
        </tr>
      </table>

      <div style="text-align:center;margin:28px 0;">
        <a href="${opts.payUrl}" style="background:${gold};color:${navy};padding:14px 36px;text-decoration:none;border-radius:6px;font-weight:700;display:inline-block;letter-spacing:0.5px;">Pay Online</a>
        <div style="color:#6b7280;font-size:12px;margin-top:10px;">Secure single-use link</div>
      </div>

      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:20px 0 0;">
        Questions about this invoice? Reply to this email or call us at <a href="tel:${phone.replace(/[^0-9]/g,'')}" style="color:${navy};">${phone}</a>.
      </p>
    </div>
    <div style="background:#f9fafb;padding:18px 24px;text-align:center;color:#6b7280;font-size:12px;border-top:3px solid ${gold};border-radius:0 0 8px 8px;">
      <div style="color:${navy};font-weight:600;margin-bottom:4px;">${agencyName}</div>
      <div>${emailAddr} • ${phone}</div>
      <div style="margin-top:4px;"><a href="${website}" style="color:${navy};text-decoration:none;">${website}</a></div>
    </div>
  </div>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    const resend = new Resend(RESEND_API_KEY);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: ReqBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const reminderDays = body.reminder_days_before ?? 7;
    const dryRun = body.dry_run === true;

    // Build the list of QBO invoices to consider
    let invoiceQuery = supabase
      .from("qbo_invoices")
      .select("qbo_id, qbo_customer_id, crm_booking_id, doc_number, total_amt, balance, due_date, txn_date, status")
      .gt("balance", 0);

    if (body.qbo_invoice_id) {
      invoiceQuery = invoiceQuery.eq("qbo_id", body.qbo_invoice_id);
    }

    const { data: qboInvoices, error: qErr } = await invoiceQuery;
    if (qErr) throw qErr;

    if (!qboInvoices || qboInvoices.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "No invoices to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Branding (single agency)
    const { data: brandingRow } = await supabase
      .from("branding_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // SAFEGUARD: in cron mode (no specific invoice, no explicit email_kind),
    // send at most ONE invoice statement per client per run — the soonest
    // unpaid invoice that hasn't been emailed yet. This prevents a client
    // from receiving a flood of separate "New Invoice" emails when they
    // have multiple unpaid installments on a payment plan.
    const isCronMode = !body.qbo_invoice_id && !body.email_kind && !body.test_recipient;
    const clientsEmailedThisRun = new Set<string>();

    let invoicesToProcess = qboInvoices;
    if (isCronMode) {
      // Sort by due date ascending (nulls last) so the next-due invoice
      // is the first one we encounter for each client.
      invoicesToProcess = [...qboInvoices].sort((a, b) => {
        const ad = a.due_date ? new Date(`${a.due_date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
        const bd = b.due_date ? new Date(`${b.due_date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
        return ad - bd;
      });
    }

    const results: any[] = [];
    let sentCount = 0;

    for (const inv of invoicesToProcess) {
      try {
        // Resolve trip+client. Prefer crm_booking_id, fall back to qbo_customer_id mapping.
        let tripId: string | null = null;
        let bookingGross = 0;
        if (inv.crm_booking_id) {
          const { data: booking } = await supabase
            .from("bookings")
            .select("id, trip_id, gross_sales")
            .eq("id", inv.crm_booking_id)
            .maybeSingle();
          if (booking?.trip_id) {
            tripId = booking.trip_id;
            bookingGross = Number(booking.gross_sales || 0);
          }
        }

        let clientId: string | null = null;
        if (!tripId && inv.qbo_customer_id) {
          const { data: mapping } = await supabase
            .from("qbo_client_mappings")
            .select("client_id")
            .eq("qbo_customer_id", inv.qbo_customer_id)
            .maybeSingle();
          if (mapping?.client_id) {
            clientId = mapping.client_id;
            // Find latest active trip for this client
            const { data: trips } = await supabase
              .from("trips")
              .select("id")
              .eq("client_id", clientId)
              .order("created_at", { ascending: false })
              .limit(1);
            if (trips && trips.length) tripId = trips[0].id;
          }
        }

        if (!tripId) {
          results.push({ qbo_id: inv.qbo_id, skipped: "no_trip_resolved" });
          continue;
        }
        if (body.trip_id && tripId !== body.trip_id) continue;

        const { data: trip } = await supabase
          .from("trips")
          .select("id, trip_name, destination, client_id, total_gross_sales")
          .eq("id", tripId)
          .maybeSingle();
        if (!trip) { results.push({ qbo_id: inv.qbo_id, skipped: "no_trip_row" }); continue; }

        const { data: client } = await supabase
          .from("clients")
          .select("id, name, email")
          .eq("id", trip.client_id)
          .maybeSingle();
        if (!client?.email) { results.push({ qbo_id: inv.qbo_id, skipped: "no_client_email" }); continue; }

        // SAFEGUARD: in cron mode, only one invoice per client per run.
        if (isCronMode && clientsEmailedThisRun.has(client.id)) {
          results.push({ qbo_id: inv.qbo_id, skipped: "client_already_emailed_this_run", client_id: client.id });
          continue;
        }

        // Determine email kind
        const dueDate = inv.due_date ? new Date(`${inv.due_date}T00:00:00`) : null;
        const daysUntilDue = dueDate ? Math.round((dueDate.getTime() - today.getTime()) / 86400000) : null;

        let kind: "initial" | "reminder_7d" | "test" | "manual" = body.email_kind || "manual";
        if (!body.email_kind && !body.qbo_invoice_id) {
          // Cron mode
          // Check existing log for this invoice
          const { data: prior } = await supabase
            .from("invoice_email_log")
            .select("email_kind")
            .eq("qbo_invoice_id", inv.qbo_id);
          const sentKinds = new Set((prior || []).map((p: any) => p.email_kind));

          // Treat a prior "manual" send as satisfying the initial statement,
          // so we don't double-send when an agent has already fired it off.
          if (!sentKinds.has("initial") && !sentKinds.has("manual")) {
            kind = "initial";
          } else if (
            daysUntilDue !== null &&
            daysUntilDue <= reminderDays &&
            daysUntilDue >= 0 &&
            !sentKinds.has("reminder_7d")
          ) {
            kind = "reminder_7d";
          } else {
            results.push({ qbo_id: inv.qbo_id, skipped: "already_sent_or_not_due" });
            continue;
          }
        }

        // Last payment for this trip
        const { data: lastPay } = await supabase
          .from("trip_payments")
          .select("amount, payment_date")
          .eq("trip_id", trip.id)
          .eq("status", "paid")
          .order("payment_date", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        // Total remaining for this trip = sum of unpaid trip_payments
        const { data: unpaid } = await supabase
          .from("trip_payments")
          .select("amount")
          .eq("trip_id", trip.id)
          .neq("status", "paid");
        const totalRemaining = (unpaid || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

        const openingBalance = Number(trip.total_gross_sales || bookingGross || 0);

        const recipient = body.test_recipient || client.email;
        const invoiceNumber = inv.doc_number || `QBO-${inv.qbo_id}`;

        // Mint a tokenized secure payment link for this recipient
        let payUrl = GENERIC_PAY_URL;
        try {
          const token = generateToken();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          const { error: linkErr } = await supabase.from("secure_links").insert({
            token,
            link_type: "payment",
            client_name: client.name,
            client_email: recipient,
            booking_ref: invoiceNumber,
            trip_name: trip.trip_name,
            amount: Number(inv.balance || 0),
            notes: `Auto-generated from invoice statement (${kind})`,
            expires_at: expiresAt,
            single_use: false,
            active: true,
          });
          if (!linkErr) {
            const payload: Record<string, string> = {
              token,
              ref: invoiceNumber,
              invoice: invoiceNumber,
              name: client.name,
              email: recipient,
            };
            payUrl = `${SITE_URL}${PAY_PATH}?d=${encodePayload(payload)}`;
          } else {
            console.error("secure_link insert failed:", linkErr);
          }
        } catch (linkE) {
          console.error("secure_link mint error:", linkE);
        }

        const html = buildHtml({
          brand: brandingRow,
          clientName: client.name,
          tripName: trip.trip_name,
          destination: trip.destination,
          invoiceNumber,
          qboInvoiceId: inv.qbo_id,
          amountDue: Number(inv.balance || 0),
          dueDate: inv.due_date,
          openingBalance,
          totalRemaining,
          lastPaymentAmount: lastPay ? Number(lastPay.amount) : null,
          lastPaymentDate: lastPay?.payment_date || null,
          isReminder: kind === "reminder_7d",
          payUrl,
        });

        const subject =
          kind === "reminder_7d"
            ? `Reminder: Invoice ${invoiceNumber} due ${fmtDate(inv.due_date)} — ${fmt(Number(inv.balance))}`
            : `Invoice ${invoiceNumber} — ${trip.trip_name} (${fmt(Number(inv.balance))} due ${fmtDate(inv.due_date)})`;

        if (dryRun) {
          results.push({ qbo_id: inv.qbo_id, kind, recipient, subject, dry_run: true });
          continue;
        }

        const sendResp = await resend.emails.send({
          from: `${brandingRow?.agency_name || "Crestwell Travel Services"} <noreply@crestwellgetaways.com>`,
          to: [recipient],
          subject,
          html,
        });

        await supabase.from("invoice_email_log").insert({
          qbo_invoice_id: inv.qbo_id,
          trip_id: trip.id,
          client_id: client.id,
          recipient_email: recipient,
          email_kind: body.test_recipient ? "test" : kind,
          resend_id: (sendResp as any)?.data?.id || null,
          due_date: inv.due_date,
          amount: Number(inv.balance || 0),
          meta: { invoice_number: invoiceNumber, subject },
        });

        // Mirror into email_logs so this send appears in the Email Activity dashboard
        const sendError = (sendResp as any)?.error;
        const providerId = (sendResp as any)?.data?.id || null;
        const mirrorTemplate = kind === "reminder_7d" ? "payment_reminder" : "invoice_statement";
        await supabase.from("email_logs").insert({
          client_id: client.id,
          to_email: recipient,
          subject,
          template: mirrorTemplate,
          status: sendError ? "failed" : "sent",
          provider_message_id: providerId,
          error_message: sendError ? String(sendError?.message || sendError) : null,
          idempotency_key: `invoice-${inv.qbo_id}-${kind}`,
          metadata: {
            source: "send-invoice-statement",
            email_kind: body.test_recipient ? "test" : kind,
            qbo_invoice_id: inv.qbo_id,
            invoice_number: invoiceNumber,
            trip_id: trip.id,
            amount_due: Number(inv.balance || 0),
            due_date: inv.due_date,
          },
        });

        sentCount++;
        results.push({ qbo_id: inv.qbo_id, kind, recipient, sent: true, resend_id: (sendResp as any)?.data?.id });
        if (isCronMode) clientsEmailedThisRun.add(client.id);
      } catch (e) {
        console.error("Failed for invoice", inv.qbo_id, e);
        results.push({ qbo_id: inv.qbo_id, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: sentCount, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);