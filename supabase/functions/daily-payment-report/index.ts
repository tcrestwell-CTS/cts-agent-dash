import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
import Stripe from "https://esm.sh/stripe@18.5.0";

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
    let body: { date?: string; sendEmail?: boolean; clientEmail?: string } = {};
    try {
      body = await req.json();
    } catch (_) { /* no body */ }

    const clientFilter = (body.clientEmail || "").toLowerCase().trim();
    const isFiltered = !!clientFilter;

    // Default: yesterday in America/New_York (Eastern reporting day)
    const nowEasternParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const easternToday = `${nowEasternParts.find((p) => p.type === "year")!.value}-${nowEasternParts.find((p) => p.type === "month")!.value}-${nowEasternParts.find((p) => p.type === "day")!.value}`;
    const target = body.date
      ? body.date
      : new Date(new Date(easternToday + "T12:00:00Z").getTime() - 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

    // Pull succeeded Stripe charges for the target Eastern day window
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Compute UTC epoch bounds for target date in America/New_York.
    // ET is UTC-5 (EST) or UTC-4 (EDT). Detect offset via Intl.
    function easternOffsetHours(dateUtc: Date): number {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        timeZoneName: "shortOffset",
      }).formatToParts(dateUtc);
      const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
      const m = tz.match(/GMT([+-]\d+)/);
      return m ? parseInt(m[1], 10) : -5;
    }
    const noonUtc = new Date(target + "T12:00:00Z");
    const offset = easternOffsetHours(noonUtc); // -5 or -4
    const dayStart = Math.floor(new Date(target + "T00:00:00Z").getTime() / 1000) - offset * 3600;
    const dayEnd = dayStart + 24 * 60 * 60;

    const charges: Stripe.Charge[] = [];
    let startingAfter: string | undefined = undefined;
    while (true) {
      const page: Stripe.ApiList<Stripe.Charge> = await stripe.charges.list({
        created: { gte: dayStart, lt: dayEnd },
        limit: 100,
        expand: ["data.balance_transaction"],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const c of page.data) {
        if (c.status === "succeeded" && !c.refunded) charges.push(c);
      }
      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1]?.id;
      if (!startingAfter) break;
    }

    // Build payment rows and resolve client/trip by email
    type Payment = {
      amount: number;
      fee: number;
      net: number;
      email: string | null;
      description: string;
      receiptUrl: string | null;
      chargeId: string;
    };
    const rawPayments: Payment[] = charges.map((c) => {
      const gross = (c.amount ?? 0) / 100;
      const bt = c.balance_transaction as Stripe.BalanceTransaction | null;
      const fee = bt && typeof bt === "object" && bt.fee ? bt.fee / 100 : 0;
      return {
        amount: gross,
        fee,
        net: Math.round((gross - fee) * 100) / 100,
        email: (c.billing_details?.email || c.receipt_email || null)?.toLowerCase() ?? null,
        description: c.description || c.statement_descriptor || "Stripe payment",
        receiptUrl: c.receipt_url ?? null,
        chargeId: c.id,
      };
    });

    // Look up clients by email in one query
    const emails = Array.from(new Set(rawPayments.map((p) => p.email).filter((e): e is string => !!e)));
    type TripLite = { id: string; trip_name: string; destination: string | null; created_at: string };
    const clientMap = new Map<string, { id: string; name: string; email: string; trip: string | null; destination: string | null; tripIds: string[]; trips: TripLite[] }>();
    if (emails.length > 0) {
      const { data: clientsRows } = await supabase
        .from("clients")
        .select("id, name, email, trips:trips(id, trip_name, destination, created_at)")
        .in("email", emails);
      for (const c of clientsRows ?? []) {
        const trips = ((c as any).trips ?? []) as TripLite[];
        const latest = trips.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
        const em = ((c as any).email as string | null)?.toLowerCase();
        if (em) {
          clientMap.set(em, {
            id: (c as any).id,
            name: (c as any).name || em,
            email: em,
            trip: latest?.trip_name ?? null,
            destination: latest?.destination ?? null,
            tripIds: trips.map((t) => t.id).filter(Boolean),
            trips,
          });
        }
      }
    }

    // ====== AUTO-APPLY payments to trip_payments + flag unmatched ======
    type FlagReason = "no_client" | "no_matching_payment" | "ambiguous" | "already_applied" | "error";
    type FlagRow = { charge: Payment; reason: FlagReason; detail?: string };
    const applied: Array<{ charge: Payment; tripPaymentId: string; clientName: string }> = [];
    const flagged: FlagRow[] = [];

    if (!isFiltered) {
    for (const p of rawPayments) {
      try {
        // Skip if this Stripe charge was already applied
        const { data: existing } = await supabase
          .from("trip_payments")
          .select("id, status")
          .eq("stripe_payment_intent_id", p.chargeId)
          .limit(1)
          .maybeSingle();
        if (existing?.id) {
          if (existing.status !== "paid") {
            await supabase
              .from("trip_payments")
              .update({
                status: "paid",
                payment_date: target,
                stripe_receipt_url: p.receiptUrl,
                stripe_fee: p.fee > 0 ? p.fee : null,
                amount: p.net,
              })
              .eq("id", existing.id);
          }
          continue;
        }

        const client = p.email ? clientMap.get(p.email) : null;
        if (!client || client.tripIds.length === 0) {
          flagged.push({ charge: p, reason: "no_client", detail: p.email ?? "no email on charge" });
          continue;
        }

        // Prefer matching by trip name found in charge description/metadata.
        // If none matches, fall back to email-only (any of the client's trips).
        const hay = `${p.description ?? ""}`.toLowerCase();
        const nameMatched = client.trips.filter((t) => {
          const n = (t.trip_name || "").toLowerCase().trim();
          const d = (t.destination || "").toLowerCase().trim();
          return (n && n.length >= 3 && hay.includes(n)) ||
                 (d && d.length >= 3 && hay.includes(d));
        });
        const scopedTripIds = nameMatched.length > 0
          ? nameMatched.map((t) => t.id)
          : client.tripIds;

        const { data: candidates } = await supabase
          .from("trip_payments")
          .select("id, amount, status, trip_id")
          .in("trip_id", scopedTripIds)
          .in("status", ["pending", "scheduled", "due"]);

        // Primary match: within $0.50 or 2% — handles rounding and minor discrepancies
        const primaryTolerance = Math.max(0.50, p.amount * 0.02);
        const matches = (candidates ?? []).filter(
          (r) => Math.abs(Number(r.amount) - p.amount) <= primaryTolerance,
        );

        if (matches.length === 0) {
          // ── Gap 1 fix: try loan_payment_schedules ──────────────────────────
          const { data: loanMatches } = await supabase
            .from("loan_payment_schedules")
            .select("id, amount, status, loan_id")
            .eq("status", "pending")
            .filter("loan_id", "in", `(select id from loans where client_id = '${client.id}')`)
            .filter("amount", "gte", p.amount - 0.50)
            .filter("amount", "lte", p.amount + 0.50);

          if (loanMatches && loanMatches.length === 1) {
            const lm = loanMatches[0];
            await supabase
              .from("loan_payment_schedules")
              .update({
                status: "paid",
                paid_at: new Date().toISOString(),
                paid_amount: p.net,
                stripe_charge_id: p.chargeId,
                stripe_fee: p.fee > 0 ? p.fee : null,
                stripe_receipt_url: p.receiptUrl,
              })
              .eq("id", lm.id);
            applied.push({ charge: p, tripPaymentId: `loan:${lm.id}`, clientName: client.name });
            continue;
          }

          // ── Gap 2 fix: loosen amount tolerance for partial/ad-hoc payments ─
          // If no exact match, try within 5% tolerance and create an ad-hoc row
          const { data: tripRows } = await supabase
            .from("trip_payments")
            .select("id, amount, status, trip_id")
            .in("trip_id", client.tripIds)
            .in("status", ["pending", "scheduled", "due"]);

          // Find closest pending installment within 5%
          const tolerance = p.amount * 0.05;
          const softMatches = (tripRows ?? []).filter(
            (r) => Math.abs(Number(r.amount) - p.amount) <= Math.max(tolerance, 5.00)
          ).sort((a, b) => Math.abs(Number(a.amount) - p.amount) - Math.abs(Number(b.amount) - p.amount));

          if (softMatches.length > 0) {
            // Partial/ad-hoc: update the closest match with actual paid amount
            const sm = softMatches[0];
            await supabase
              .from("trip_payments")
              .update({
                status: "paid",
                payment_date: target,
                payment_method: "credit_card",
                stripe_payment_intent_id: p.chargeId,
                stripe_receipt_url: p.receiptUrl,
                stripe_fee: p.fee > 0 ? p.fee : null,
                amount: p.net, // actual net paid, not scheduled amount
                notes: `Ad-hoc/partial payment — scheduled ${fmtMoney(Number(sm.amount))}, received ${fmtMoney(p.amount)}`,
              })
              .eq("id", sm.id);
            applied.push({ charge: p, tripPaymentId: sm.id, clientName: client.name });
            continue;
          }

          // Nothing matched — insert ad-hoc trip_payment on most recent trip
          const latestTripId = client.tripIds[0];
          if (latestTripId) {
            const { data: newRow } = await supabase
              .from("trip_payments")
              .insert({
                trip_id: latestTripId,
                label: `Ad-hoc payment — ${p.description}`,
                amount: p.net,
                status: "paid",
                payment_date: target,
                payment_method: "credit_card",
                stripe_payment_intent_id: p.chargeId,
                stripe_receipt_url: p.receiptUrl,
                stripe_fee: p.fee > 0 ? p.fee : null,
                notes: `Auto-created by daily reconciler — no matching scheduled installment found`,
              })
              .select("id")
              .maybeSingle();
            if (newRow?.id) {
              applied.push({ charge: p, tripPaymentId: newRow.id, clientName: client.name });
              continue;
            }
          }

          flagged.push({
            charge: p,
            reason: "no_matching_payment",
            detail: `${client.name} has no pending payment near ${fmtMoney(p.amount)} — ad-hoc insert also failed`,
          });
          continue;
        }
        if (matches.length > 1) {
          flagged.push({
            charge: p,
            reason: "ambiguous",
            detail: `${client.name} has ${matches.length} pending payments of ${fmtMoney(p.amount)}`,
          });
          continue;
        }

        const target_tp = matches[0];
        const { error: upErr } = await supabase
          .from("trip_payments")
          .update({
            status: "paid",
            payment_date: target,
            payment_method: "credit_card",
            stripe_payment_intent_id: p.chargeId,
            stripe_receipt_url: p.receiptUrl,
            stripe_fee: p.fee > 0 ? p.fee : null,
            amount: p.net,
          })
          .eq("id", target_tp.id);
        if (upErr) throw upErr;
        applied.push({ charge: p, tripPaymentId: target_tp.id, clientName: client.name });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        flagged.push({ charge: p, reason: "error", detail: msg });
      }
    }
    }

    // Persist flagged items to exception_queue (idempotent by source_record_id)
    for (const f of flagged) {
      // Before flagging — check if this charge was already matched by the
      // primary webhook path (stripe_payment_intent_id on trip_payments).
      // If so, auto-resolve the exception rather than creating a duplicate.
      const { data: alreadyMatched } = await supabase
        .from("trip_payments")
        .select("id, status")
        .eq("stripe_payment_intent_id", f.charge.chargeId)
        .limit(1)
        .maybeSingle();

      if (alreadyMatched?.id) {
        // Charge already landed via webhook — resolve any existing exception row
        await supabase
          .from("exception_queue")
          .update({ status: "resolved", description: `Auto-resolved — matched by stripe-webhook to trip_payment ${alreadyMatched.id}` })
          .eq("source_system", "stripe")
          .eq("source_record_id", f.charge.chargeId);
        continue; // do not insert new exception row
      }

      // Also check loan_payment_schedules
      const { data: alreadyLoan } = await supabase
        .from("loan_payment_schedules")
        .select("id")
        .eq("stripe_charge_id", f.charge.chargeId)
        .limit(1)
        .maybeSingle();

      if (alreadyLoan?.id) {
        await supabase
          .from("exception_queue")
          .update({ status: "resolved", description: `Auto-resolved — matched to loan_payment_schedule ${alreadyLoan.id}` })
          .eq("source_system", "stripe")
          .eq("source_record_id", f.charge.chargeId);
        continue;
      }

      const { data: dup } = await supabase
        .from("exception_queue")
        .select("id")
        .eq("source_system", "stripe")
        .eq("source_record_id", f.charge.chargeId)
        .limit(1)
        .maybeSingle();
      if (dup?.id) continue;
      await supabase.from("exception_queue").insert({
        exception_type: "unidentified_stripe_payment",
        source_system: "stripe",
        source_record_id: f.charge.chargeId,
        source_record_type: "charge",
        amount: f.charge.amount,
        status: "open",
        description: `[${f.reason}] ${f.charge.email ?? "no email"} · ${f.charge.description} · ${f.detail ?? ""}`,
      });
    }

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

    for (const p of rawPayments) {
      const matched = p.email ? clientMap.get(p.email) : null;
      const name = matched?.name || (p.email ? p.email : "Unknown client");
      const email = p.email;
      const key = `${name}|${email ?? ""}`;
      grandTotal += p.amount;
      const g = groups.get(key) ?? {
        clientName: name,
        clientEmail: email,
        total: 0,
        count: 0,
        items: [],
      };
      g.total += p.amount;
      g.count += 1;
      g.items.push({
        amount: p.amount,
        type: p.description,
        trip: matched?.trip || "—",
        destination: matched?.destination ?? null,
        receiptUrl: p.receiptUrl,
      });
      groups.set(key, g);
    }

    const clients = Array.from(groups.values()).sort(
      (a, b) => b.total - a.total,
    );

    const summary = {
      date: target,
      grandTotal,
      paymentCount: rawPayments.length,
      clientCount: clients.length,
      clients,
      appliedCount: applied.length,
      flaggedCount: flagged.length,
      flagged: flagged.map((f) => ({
        chargeId: f.charge.chargeId,
        email: f.charge.email,
        amount: f.charge.amount,
        reason: f.reason,
        detail: f.detail ?? null,
      })),
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
            <div style="margin-top:20px;padding:12px 16px;background:#ecfdf5;border:1px solid #86efac;border-radius:8px;color:#065f46;font-size:13px;">
              <strong>${applied.length}</strong> payment${applied.length === 1 ? "" : "s"} auto-applied to client trips.
            </div>
            ${flagged.length === 0 ? "" : `
              <div style="margin-top:12px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                <div style="font-weight:600;color:#991b1b;margin-bottom:8px;">
                  ${flagged.length} unidentified payment${flagged.length === 1 ? "" : "s"} flagged for review
                </div>
                <div style="font-size:13px;color:#7f1d1d;">
                  ${flagged.map((f) => `
                    <div style="margin-bottom:6px;">
                      <strong>${fmtMoney(f.charge.amount)}</strong> · ${f.charge.email ?? "no email"} · ${f.reason}
                      ${f.detail ? `<br/><span style="color:#991b1b;font-size:12px;">${f.detail}</span>` : ""}
                    </div>
                  `).join("")}
                </div>
              </div>
            `}
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