import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── 1. Fetch Stripe PaymentIntents (last 90 days, up to 100) ──
    const ninetyDaysAgo = Math.floor((Date.now() - 90 * 86400000) / 1000);
    const stripeResp = await fetch(
      `https://api.stripe.com/v1/payment_intents?limit=100&created[gte]=${ninetyDaysAgo}`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
    );
    if (!stripeResp.ok) {
      const errText = await stripeResp.text();
      throw new Error(`Stripe API error: ${stripeResp.status} ${errText}`);
    }
    const stripeData = await stripeResp.json();
    const paymentIntents = stripeData.data || [];

    // ── 2. Fetch Stripe Balance (available + pending) ──
    const balResp = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const balData = balResp.ok ? await balResp.json() : null;

    // ── 3. Fetch local checkout_payments ──
    const { data: checkoutPayments } = await admin
      .from("checkout_payments")
      .select("id, amount_cents, status, stripe_payment_intent_id, customer_email, customer_name, trip_name, created_at, payment_method")
      .gte("created_at", new Date(ninetyDaysAgo * 1000).toISOString())
      .order("created_at", { ascending: false });

    // ── 4. Fetch local trip_payments ──
    const { data: tripPayments } = await admin
      .from("trip_payments")
      .select("id, amount, status, stripe_payment_intent_id, payment_method, created_at, trip_id")
      .eq("user_id", userId)
      .gte("created_at", new Date(ninetyDaysAgo * 1000).toISOString())
      .order("created_at", { ascending: false });

    // ── 5. Build Stripe PI lookup ──
    const stripePIMap = new Map<string, any>();
    for (const pi of paymentIntents) {
      stripePIMap.set(pi.id, pi);
    }

    // ── 6. Reconcile checkout_payments vs Stripe ──
    const checkoutDiscrepancies: any[] = [];
    const matchedCheckout: any[] = [];
    const orphanedInStripe = new Map(stripePIMap); // will remove matched ones

    for (const cp of (checkoutPayments || [])) {
      const piId = cp.stripe_payment_intent_id;
      if (!piId) {
        if (cp.payment_method === "stripe" || cp.payment_method === "card") {
          checkoutDiscrepancies.push({
            type: "missing_pi_id",
            local_id: cp.id,
            customer: cp.customer_name,
            amount: cp.amount_cents / 100,
            status: cp.status,
            message: "No Stripe PaymentIntent ID recorded",
          });
        }
        continue;
      }

      const stripePi = stripePIMap.get(piId);
      orphanedInStripe.delete(piId);

      if (!stripePi) {
        checkoutDiscrepancies.push({
          type: "not_found_in_stripe",
          local_id: cp.id,
          pi_id: piId,
          customer: cp.customer_name,
          amount: cp.amount_cents / 100,
          status: cp.status,
          message: "PaymentIntent not found in Stripe (may be older than 90 days)",
        });
        continue;
      }

      const localAmount = cp.amount_cents;
      const stripeAmount = stripePi.amount;
      const amountMatch = localAmount === stripeAmount;
      const localStatus = cp.status;
      const stripeStatus = stripePi.status;

      // Map Stripe status to local status
      const statusMatch =
        (stripeStatus === "succeeded" && (localStatus === "completed" || localStatus === "paid")) ||
        (stripeStatus === "canceled" && (localStatus === "cancelled" || localStatus === "canceled")) ||
        (stripeStatus === "requires_payment_method" && localStatus === "pending") ||
        (stripeStatus === "processing" && localStatus === "processing") ||
        localStatus === stripeStatus;

      if (!amountMatch || !statusMatch) {
        checkoutDiscrepancies.push({
          type: "mismatch",
          local_id: cp.id,
          pi_id: piId,
          customer: cp.customer_name,
          local_amount: localAmount / 100,
          stripe_amount: stripeAmount / 100,
          amount_variance: (stripeAmount - localAmount) / 100,
          local_status: localStatus,
          stripe_status: stripeStatus,
          amount_match: amountMatch,
          status_match: statusMatch,
          message: !amountMatch
            ? `Amount mismatch: local $${(localAmount / 100).toFixed(2)} vs Stripe $${(stripeAmount / 100).toFixed(2)}`
            : `Status mismatch: local "${localStatus}" vs Stripe "${stripeStatus}"`,
        });
      } else {
        matchedCheckout.push({
          local_id: cp.id,
          pi_id: piId,
          amount: localAmount / 100,
          status: localStatus,
        });
      }
    }

    // ── 7. Reconcile trip_payments vs Stripe ──
    const tripDiscrepancies: any[] = [];
    const matchedTrip: any[] = [];

    for (const tp of (tripPayments || [])) {
      const piId = tp.stripe_payment_intent_id;
      if (!piId) continue; // non-stripe payments
      
      const stripePi = stripePIMap.get(piId);
      orphanedInStripe.delete(piId);

      if (!stripePi) {
        tripDiscrepancies.push({
          type: "not_found_in_stripe",
          local_id: tp.id,
          pi_id: piId,
          trip_id: tp.trip_id,
          amount: tp.amount,
          status: tp.status,
          message: "PaymentIntent not found in Stripe",
        });
        continue;
      }

      const stripeAmountDollars = stripePi.amount / 100;
      const amountMatch = Math.abs(tp.amount - stripeAmountDollars) < 0.01;
      const statusMatch =
        (stripePi.status === "succeeded" && tp.status === "completed") ||
        (stripePi.status === "canceled" && tp.status === "cancelled") ||
        tp.status === stripePi.status;

      if (!amountMatch || !statusMatch) {
        tripDiscrepancies.push({
          type: "mismatch",
          local_id: tp.id,
          pi_id: piId,
          trip_id: tp.trip_id,
          local_amount: tp.amount,
          stripe_amount: stripeAmountDollars,
          amount_variance: stripeAmountDollars - tp.amount,
          local_status: tp.status,
          stripe_status: stripePi.status,
          message: !amountMatch
            ? `Amount mismatch: local $${tp.amount.toFixed(2)} vs Stripe $${stripeAmountDollars.toFixed(2)}`
            : `Status mismatch: local "${tp.status}" vs Stripe "${stripePi.status}"`,
        });
      } else {
        matchedTrip.push({ local_id: tp.id, pi_id: piId, amount: tp.amount });
      }
    }

    // ── 8. Orphaned Stripe PIs (in Stripe but not in local DB) ──
    const orphanedPIs = Array.from(orphanedInStripe.values())
      .filter((pi: any) => pi.status === "succeeded") // only care about successful ones
      .map((pi: any) => ({
        pi_id: pi.id,
        amount: pi.amount / 100,
        status: pi.status,
        created: new Date(pi.created * 1000).toISOString(),
        customer_email: pi.receipt_email || pi.metadata?.customer_email || null,
        description: pi.description || pi.metadata?.trip_name || null,
        message: "Succeeded payment in Stripe with no matching local record",
      }));

    // ── 9. QBO Clearing check (if QBO connected) ──
    let qboClearing: any = null;
    const { data: qboConn } = await admin
      .from("qbo_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (qboConn) {
      try {
        // Refresh token if needed
        let accessToken = qboConn.access_token;
        const tokenExpiry = new Date(qboConn.token_expires_at);
        if (tokenExpiry <= new Date(Date.now() + 60000)) {
          const QBO_CLIENT_ID = Deno.env.get("QBO_CLIENT_ID")!;
          const QBO_CLIENT_SECRET = Deno.env.get("QBO_CLIENT_SECRET")!;
          const tokenResp = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: qboConn.refresh_token }),
          });
          if (tokenResp.ok) {
            const tokens = await tokenResp.json();
            accessToken = tokens.access_token;
            await admin.from("qbo_connections").update({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
            }).eq("id", qboConn.id);
          }
        }

        const qboBase = `https://quickbooks.api.intuit.com/v3/company/${qboConn.realm_id}`;
        const qboHeaders = {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        };

        // Query Stripe Clearing account
        const clearingResp = await fetch(
          `${qboBase}/query?query=${encodeURIComponent("SELECT * FROM Account WHERE Name = 'Stripe Clearing'")}`,
          { headers: qboHeaders }
        );
        if (clearingResp.ok) {
          const clearingData = await clearingResp.json();
          const account = clearingData?.QueryResponse?.Account?.[0];
          if (account) {
            const balance = parseFloat(account.CurrentBalance || "0");

            // Compare with Stripe pending balance
            const stripePending = balData?.pending?.[0]?.amount
              ? balData.pending[0].amount / 100
              : 0;

            qboClearing = {
              account_id: account.Id,
              account_name: account.Name,
              qbo_balance: balance,
              stripe_pending: stripePending,
              variance: Math.round((balance - stripePending) * 100) / 100,
              is_balanced: Math.abs(balance - stripePending) < 1.00,
              message: Math.abs(balance - stripePending) < 1.00
                ? "QBO Stripe Clearing balance matches Stripe pending balance"
                : `Variance of $${Math.abs(balance - stripePending).toFixed(2)} between QBO ($${balance.toFixed(2)}) and Stripe pending ($${stripePending.toFixed(2)})`,
            };
          } else {
            // Auto-provision the Stripe Clearing account so the health check
            // and subsequent JE postings have somewhere to land.
            try {
              const createResp = await fetch(`${qboBase}/account`, {
                method: "POST",
                headers: { ...qboHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({
                  Name: "Stripe Clearing",
                  AccountType: "Other Current Asset",
                  AccountSubType: "OtherCurrentAssets",
                }),
              });
              if (createResp.ok) {
                const created = await createResp.json();
                const acct = created?.Account;
                const stripePending = balData?.pending?.[0]?.amount
                  ? balData.pending[0].amount / 100
                  : 0;
                qboClearing = {
                  account_id: acct?.Id,
                  account_name: acct?.Name,
                  qbo_balance: 0,
                  stripe_pending: stripePending,
                  variance: Math.round((0 - stripePending) * 100) / 100,
                  is_balanced: Math.abs(stripePending) < 1.0,
                  auto_created: true,
                  message: "Stripe Clearing account auto-created in QBO (zero balance).",
                };
              } else {
                const errText = await createResp.text();
                qboClearing = {
                  account_exists: false,
                  message: `Stripe Clearing account not found and auto-create failed: ${errText}`,
                };
              }
            } catch (createErr: any) {
              qboClearing = {
                account_exists: false,
                message: `Stripe Clearing account not found; auto-create error: ${createErr.message}`,
              };
            }
          }
        }
      } catch (qboErr: any) {
        qboClearing = { error: true, message: `QBO query failed: ${qboErr.message}` };
      }
    }

    // ── 9b. Per-payment Stripe ↔ QBO deposit/sales-receipt matching ──
    let qboPaymentMatching: any = null;
    if (qboConn) {
      try {
        // Re-derive accessToken & base from qboConn (token already refreshed above if needed)
        const accessToken2 = qboConn.access_token; // refreshed in admin update above when applicable
        const qboBase2 = `https://quickbooks.api.intuit.com/v3/company/${qboConn.realm_id}`;
        const qboHeaders2 = {
          Authorization: `Bearer ${accessToken2}`,
          Accept: "application/json",
        };

        const sinceIso = new Date(ninetyDaysAgo * 1000).toISOString().split("T")[0];

        // Pull SalesReceipts, Deposits, and Payments from QBO in window
        const [srResp, depResp, payResp] = await Promise.all([
          fetch(
            `${qboBase2}/query?query=${encodeURIComponent(
              `SELECT Id, DocNumber, TxnDate, TotalAmt, PaymentRefNum, CustomerRef, PrivateNote FROM SalesReceipt WHERE TxnDate >= '${sinceIso}' MAXRESULTS 500`
            )}`,
            { headers: qboHeaders2 }
          ),
          fetch(
            `${qboBase2}/query?query=${encodeURIComponent(
              `SELECT Id, TxnDate, TotalAmt, PrivateNote FROM Deposit WHERE TxnDate >= '${sinceIso}' MAXRESULTS 500`
            )}`,
            { headers: qboHeaders2 }
          ),
          fetch(
            `${qboBase2}/query?query=${encodeURIComponent(
              `SELECT Id, TxnDate, TotalAmt, PaymentRefNum, CustomerRef, PrivateNote FROM Payment WHERE TxnDate >= '${sinceIso}' MAXRESULTS 500`
            )}`,
            { headers: qboHeaders2 }
          ),
        ]);

        const srJson = srResp.ok ? await srResp.json() : { QueryResponse: {} };
        const depJson = depResp.ok ? await depResp.json() : { QueryResponse: {} };
        const payJson = payResp.ok ? await payResp.json() : { QueryResponse: {} };

        const salesReceipts = srJson?.QueryResponse?.SalesReceipt || [];
        const deposits = depJson?.QueryResponse?.Deposit || [];
        const qboPayments = payJson?.QueryResponse?.Payment || [];

        // Build flat QBO entry list with normalized ref/amount/date
        type QboEntry = {
          type: "SalesReceipt" | "Deposit" | "Payment";
          id: string;
          ref: string | null;
          note: string | null;
          amount: number;
          date: string;
          customer_ref?: string | null;
        };
        const qboEntries: QboEntry[] = [
          ...salesReceipts.map((r: any) => ({
            type: "SalesReceipt" as const,
            id: r.Id,
            ref: r.PaymentRefNum || r.DocNumber || null,
            note: r.PrivateNote || null,
            amount: Number(r.TotalAmt || 0),
            date: r.TxnDate,
            customer_ref: r.CustomerRef?.name || r.CustomerRef?.value || null,
          })),
          ...qboPayments.map((p: any) => ({
            type: "Payment" as const,
            id: p.Id,
            ref: p.PaymentRefNum || null,
            note: p.PrivateNote || null,
            amount: Number(p.TotalAmt || 0),
            date: p.TxnDate,
            customer_ref: p.CustomerRef?.name || p.CustomerRef?.value || null,
          })),
          ...deposits.map((d: any) => ({
            type: "Deposit" as const,
            id: d.Id,
            ref: null,
            note: d.PrivateNote || null,
            amount: Number(d.TotalAmt || 0),
            date: d.TxnDate,
          })),
        ];

        // Index by PI id (if it appears in ref/note) for fast lookup
        const qboByPi = new Map<string, QboEntry>();
        for (const e of qboEntries) {
          const blob = `${e.ref || ""} ${e.note || ""}`;
          const m = blob.match(/pi_[A-Za-z0-9]+/);
          if (m) qboByPi.set(m[0], e);
        }

        // Match each succeeded Stripe PI against QBO
        const succeededPIs = paymentIntents.filter((pi: any) => pi.status === "succeeded");
        const stripeMatched: any[] = [];
        const stripeUnmatchedInQbo: any[] = [];
        const qboMatchedIds = new Set<string>();

        for (const pi of succeededPIs) {
          const piAmount = pi.amount / 100;
          const piDate = new Date(pi.created * 1000);
          const piEmail = (pi.receipt_email || pi.metadata?.customer_email || "").toLowerCase();

          // 1. Direct PI-id reference
          let match: QboEntry | undefined = qboByPi.get(pi.id);
          let matchReason = match ? "pi_id_in_ref" : "";

          // 2. Amount + date (±3 days) + optional email in note
          if (!match) {
            for (const e of qboEntries) {
              if (qboMatchedIds.has(`${e.type}:${e.id}`)) continue;
              if (Math.abs(e.amount - piAmount) > 0.01) continue;
              const eDate = new Date(e.date + "T00:00:00");
              const dayDiff = Math.abs((eDate.getTime() - piDate.getTime()) / 86400000);
              if (dayDiff > 3) continue;
              const noteBlob = `${e.ref || ""} ${e.note || ""} ${e.customer_ref || ""}`.toLowerCase();
              if (piEmail && noteBlob.includes(piEmail)) {
                match = e; matchReason = "amount_date_email"; break;
              }
              // Fallback: amount+date alone — weaker, store as candidate
              if (!match) { match = e; matchReason = "amount_date_only"; }
            }
          }

          if (match) {
            qboMatchedIds.add(`${match.type}:${match.id}`);
            stripeMatched.push({
              pi_id: pi.id,
              amount: piAmount,
              created: piDate.toISOString(),
              customer_email: piEmail || null,
              qbo_type: match.type,
              qbo_id: match.id,
              qbo_ref: match.ref,
              qbo_amount: match.amount,
              qbo_date: match.date,
              match_reason: matchReason,
              confidence: matchReason === "pi_id_in_ref" ? "high"
                : matchReason === "amount_date_email" ? "medium" : "low",
            });
          } else {
            stripeUnmatchedInQbo.push({
              pi_id: pi.id,
              amount: piAmount,
              created: piDate.toISOString(),
              customer_email: piEmail || null,
              description: pi.description || pi.metadata?.trip_name || null,
              message: "Stripe payment has no matching QBO Sales Receipt, Payment, or Deposit",
            });
          }
        }

        // QBO entries with no Stripe counterpart
        const qboUnmatched = qboEntries
          .filter((e) => !qboMatchedIds.has(`${e.type}:${e.id}`))
          .map((e) => ({
            qbo_type: e.type,
            qbo_id: e.id,
            ref: e.ref,
            amount: e.amount,
            date: e.date,
            note: e.note,
          }));

        qboPaymentMatching = {
          window_days: 90,
          stripe_succeeded_count: succeededPIs.length,
          qbo_entry_count: qboEntries.length,
          matched_count: stripeMatched.length,
          unmatched_in_qbo_count: stripeUnmatchedInQbo.length,
          unmatched_in_stripe_count: qboUnmatched.length,
          matched: stripeMatched,
          unmatched_in_qbo: stripeUnmatchedInQbo,
          unmatched_in_stripe: qboUnmatched,
        };
      } catch (matchErr: any) {
        qboPaymentMatching = { error: true, message: `QBO matching failed: ${matchErr.message}` };
      }
    }

    // ── 10. Build summary ──
    const totalDiscrepancies = checkoutDiscrepancies.length + tripDiscrepancies.length + orphanedPIs.length;
    const totalMatched = matchedCheckout.length + matchedTrip.length;

    const stripeAvailable = balData?.available?.[0]?.amount ? balData.available[0].amount / 100 : 0;
    const stripePending = balData?.pending?.[0]?.amount ? balData.pending[0].amount / 100 : 0;

    // Sum local totals
    const localCompletedTotal = [
      ...(checkoutPayments || []).filter(c => c.status === "completed" || c.status === "paid").map(c => c.amount_cents / 100),
      ...(tripPayments || []).filter(t => t.status === "completed").map(t => t.amount),
    ].reduce((s, a) => s + a, 0);

    const stripeSucceededTotal = paymentIntents
      .filter((pi: any) => pi.status === "succeeded")
      .reduce((s: number, pi: any) => s + pi.amount / 100, 0);

    return new Response(
      JSON.stringify({
        ok: true,
        checked_at: new Date().toISOString(),
        summary: {
          total_stripe_pis: paymentIntents.length,
          total_local_checkout: (checkoutPayments || []).length,
          total_local_trip: (tripPayments || []).length,
          matched: totalMatched,
          discrepancies: totalDiscrepancies,
          orphaned_in_stripe: orphanedPIs.length,
          all_clear: totalDiscrepancies === 0,
        },
        stripe_balance: {
          available: stripeAvailable,
          pending: stripePending,
        },
        volume_comparison: {
          stripe_succeeded_total: Math.round(stripeSucceededTotal * 100) / 100,
          local_completed_total: Math.round(localCompletedTotal * 100) / 100,
          variance: Math.round((stripeSucceededTotal - localCompletedTotal) * 100) / 100,
        },
        checkout_discrepancies: checkoutDiscrepancies,
        trip_discrepancies: tripDiscrepancies,
        orphaned_stripe_payments: orphanedPIs,
        qbo_clearing: qboClearing,
        qbo_payment_matching: qboPaymentMatching,
      }),
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Stripe reconciliation error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
