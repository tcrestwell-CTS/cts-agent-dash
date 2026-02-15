import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QBO_SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com/v3/company";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Authenticate caller via getClaims ──────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized – invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;

  // ── Get QBO connection ─────────────────────────────────────────────
  const { data: connection, error: connError } = await supabaseAdmin
    .from("qbo_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (connError || !connection) {
    return new Response(
      JSON.stringify({ error: "No active QBO connection. Please connect first." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Auto-refresh token if expired ──────────────────────────────────
  const tokenExpiry = new Date(connection.token_expires_at);
  if (tokenExpiry <= new Date(Date.now() + 60000)) {
    const QBO_CLIENT_ID = Deno.env.get("QBO_CLIENT_ID")!;
    const QBO_CLIENT_SECRET = Deno.env.get("QBO_CLIENT_SECRET")!;
    const basicAuth = btoa(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`);

    const tokenResp = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token,
      }),
    });

    if (!tokenResp.ok) {
      await supabaseAdmin.from("qbo_connections").update({ is_active: false }).eq("id", connection.id);
      return new Response(
        JSON.stringify({ error: "QBO token expired. Please reconnect." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokens = await tokenResp.json();
    connection.access_token = tokens.access_token;
    connection.refresh_token = tokens.refresh_token;
    await supabaseAdmin.from("qbo_connections").update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }).eq("id", connection.id);
  }

  const qboBase = `${QBO_SANDBOX_BASE}/${connection.realm_id}`;
  const qboHeaders = {
    Authorization: `Bearer ${connection.access_token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const syncUrl = new URL(req.url);
  const urlPath = syncUrl.searchParams.get("action") || syncUrl.pathname.split("/").filter(Boolean).pop();

  try {
    // ── POST ?action=sync-clients ────────────────────────────────────
    if (urlPath === "sync-clients" && req.method === "POST") {
      const { client_ids } = await req.json();

      let query = supabaseAdmin.from("clients").select("*").eq("user_id", userId);
      if (client_ids?.length) {
        query = query.in("id", client_ids);
      }
      const { data: clients, error: clientsError } = await query;
      if (clientsError) throw clientsError;

      const { data: mappings } = await supabaseAdmin
        .from("qbo_client_mappings")
        .select("client_id, qbo_customer_id")
        .eq("user_id", userId);
      const mappingMap = new Map((mappings || []).map((m: any) => [m.client_id, m.qbo_customer_id]));

      let created = 0, updated = 0, errors = 0;

      for (const client of clients || []) {
        try {
          const displayName = client.name || `${client.first_name || ""} ${client.last_name || ""}`.trim();
          const customerData: any = {
            DisplayName: displayName.substring(0, 100),
            GivenName: (client.first_name || displayName.split(" ")[0] || "").substring(0, 25),
            FamilyName: (client.last_name || displayName.split(" ").slice(1).join(" ") || "").substring(0, 25),
          };
          if (client.email) customerData.PrimaryEmailAddr = { Address: client.email.substring(0, 100) };
          if (client.phone) customerData.PrimaryPhone = { FreeFormNumber: client.phone.substring(0, 30) };

          const existingQboId = mappingMap.get(client.id);

          if (existingQboId) {
            const getResp = await fetch(`${qboBase}/customer/${existingQboId}`, { headers: qboHeaders });
            if (getResp.ok) {
              const existing = await getResp.json();
              customerData.Id = existingQboId;
              customerData.SyncToken = existing.Customer.SyncToken;
              const updateResp = await fetch(`${qboBase}/customer`, {
                method: "POST",
                headers: qboHeaders,
                body: JSON.stringify(customerData),
              });
              if (updateResp.ok) updated++;
              else errors++;
            }
          } else {
            const createResp = await fetch(`${qboBase}/customer`, {
              method: "POST",
              headers: qboHeaders,
              body: JSON.stringify(customerData),
            });
            if (createResp.ok) {
              const result = await createResp.json();
              await supabaseAdmin.from("qbo_client_mappings").insert({
                user_id: userId,
                client_id: client.id,
                qbo_customer_id: result.Customer.Id,
              });
              created++;
            } else {
              const errText = await createResp.text();
              console.error(`Failed to create QBO customer for ${client.id}:`, errText);
              errors++;
            }
          }
        } catch (e) {
          console.error(`Error syncing client ${client.id}:`, e);
          errors++;
        }
      }

      await supabaseAdmin.from("qbo_sync_logs").insert({
        user_id: userId,
        sync_type: "clients",
        direction: "push",
        status: errors > 0 ? "partial" : "success",
        records_processed: created + updated,
        details: { created, updated, errors },
      });

      return new Response(
        JSON.stringify({ success: true, created, updated, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── POST ?action=sync-invoice ────────────────────────────────────
    if (urlPath === "sync-invoice" && req.method === "POST") {
      const { invoice_id } = await req.json();
      if (!invoice_id) {
        return new Response(JSON.stringify({ error: "invoice_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: invoice, error: invError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("id", invoice_id)
        .eq("user_id", userId)
        .single();
      if (invError || !invoice) {
        return new Response(JSON.stringify({ error: "Invoice not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let qboCustomerId: string | null = null;
      if (invoice.client_id) {
        const { data: mapping } = await supabaseAdmin
          .from("qbo_client_mappings")
          .select("qbo_customer_id")
          .eq("user_id", userId)
          .eq("client_id", invoice.client_id)
          .single();
        qboCustomerId = mapping?.qbo_customer_id || null;
      }

      if (!qboCustomerId && invoice.client_id) {
        const { data: client } = await supabaseAdmin
          .from("clients")
          .select("*")
          .eq("id", invoice.client_id)
          .single();

        if (client) {
          const displayName = client.name || `${client.first_name || ""} ${client.last_name || ""}`.trim();
          const createResp = await fetch(`${qboBase}/customer`, {
            method: "POST",
            headers: qboHeaders,
            body: JSON.stringify({
              DisplayName: displayName.substring(0, 100),
              GivenName: (client.first_name || displayName.split(" ")[0] || "").substring(0, 25),
              FamilyName: (client.last_name || "").substring(0, 25),
              ...(client.email ? { PrimaryEmailAddr: { Address: client.email.substring(0, 100) } } : {}),
            }),
          });
          if (createResp.ok) {
            const result = await createResp.json();
            qboCustomerId = result.Customer.Id;
            await supabaseAdmin.from("qbo_client_mappings").insert({
              user_id: userId,
              client_id: invoice.client_id,
              qbo_customer_id: qboCustomerId!,
            });
          }
        }
      }

      const qboInvoice: any = {
        DocNumber: invoice.invoice_number?.substring(0, 21),
        TxnDate: invoice.invoice_date,
        Line: [
          {
            Amount: invoice.total_amount,
            DetailType: "SalesItemLineDetail",
            SalesItemLineDetail: {
              ItemRef: { value: "1", name: "Services" },
            },
            Description: invoice.trip_name || "Travel Services",
          },
        ],
      };

      if (qboCustomerId) {
        qboInvoice.CustomerRef = { value: qboCustomerId };
      }

      const createResp = await fetch(`${qboBase}/invoice`, {
        method: "POST",
        headers: qboHeaders,
        body: JSON.stringify(qboInvoice),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        console.error("QBO invoice creation failed:", errText);
        await supabaseAdmin.from("qbo_sync_logs").insert({
          user_id: userId,
          sync_type: "invoice",
          direction: "push",
          status: "error",
          error_message: errText.substring(0, 500),
        });
        return new Response(
          JSON.stringify({ error: "Failed to create QBO invoice", details: errText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await createResp.json();
      await supabaseAdmin.from("qbo_invoice_mappings").insert({
        user_id: userId,
        invoice_id: invoice.id,
        qbo_invoice_id: result.Invoice.Id,
      });

      await supabaseAdmin.from("qbo_sync_logs").insert({
        user_id: userId,
        sync_type: "invoice",
        direction: "push",
        status: "success",
        records_processed: 1,
      });

      return new Response(
        JSON.stringify({ success: true, qbo_invoice_id: result.Invoice.Id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GET ?action=financial-summary ─────────────────────────────────
    if (urlPath === "financial-summary" && req.method === "GET") {
      const plResp = await fetch(
        `${qboBase}/reports/ProfitAndLoss?date_macro=This Month`,
        { headers: qboHeaders }
      );

      const bsResp = await fetch(
        `${qboBase}/reports/BalanceSheet`,
        { headers: qboHeaders }
      );

      const summary: any = { profit_and_loss: null, balance_sheet: null };

      if (plResp.ok) {
        const plData = await plResp.json();
        const rows = plData.Rows?.Row || [];
        const income = rows.find((r: any) => r.group === "Income");
        const expenses = rows.find((r: any) => r.group === "Expenses");
        summary.profit_and_loss = {
          period: plData.Header?.ReportName,
          total_income: parseFloat(income?.Summary?.ColData?.[1]?.value || "0"),
          total_expenses: parseFloat(expenses?.Summary?.ColData?.[1]?.value || "0"),
          net_income: parseFloat(
            rows.find((r: any) => r.group === "NetIncome")?.Summary?.ColData?.[1]?.value || "0"
          ),
        };
      }

      if (bsResp.ok) {
        const bsData = await bsResp.json();
        const rows = bsData.Rows?.Row || [];
        const assets = rows.find((r: any) => r.group === "TotalAssets" || r.Header?.ColData?.[0]?.value === "TOTAL ASSETS");
        summary.balance_sheet = {
          total_assets: parseFloat(assets?.Summary?.ColData?.[1]?.value || "0"),
        };
      }

      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST ?action=sync-payments ───────────────────────────────────
    if (urlPath === "sync-payments" && req.method === "POST") {
      const queryResp = await fetch(
        `${qboBase}/query?query=${encodeURIComponent("SELECT * FROM Payment WHERE MetaData.LastUpdatedTime > '2020-01-01' MAXRESULTS 100")}`,
        { headers: qboHeaders }
      );

      if (!queryResp.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to query QBO payments" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const queryData = await queryResp.json();
      const payments = queryData.QueryResponse?.Payment || [];

      const { data: invoiceMappings } = await supabaseAdmin
        .from("qbo_invoice_mappings")
        .select("invoice_id, qbo_invoice_id")
        .eq("user_id", userId);

      const qboToLocalMap = new Map(
        (invoiceMappings || []).map((m: any) => [m.qbo_invoice_id, m.invoice_id])
      );

      let matchedPayments = 0;
      for (const payment of payments) {
        const lines = payment.Line || [];
        for (const line of lines) {
          const linkedTxns = line.LinkedTxn || [];
          for (const txn of linkedTxns) {
            if (txn.TxnType === "Invoice") {
              const localInvoiceId = qboToLocalMap.get(txn.TxnId);
              if (localInvoiceId) {
                const paidAmount = parseFloat(payment.TotalAmt || "0");
                await supabaseAdmin
                  .from("invoices")
                  .update({
                    amount_paid: paidAmount,
                    amount_remaining: Math.max(0, paidAmount),
                    status: "paid",
                  })
                  .eq("id", localInvoiceId)
                  .eq("user_id", userId);
                matchedPayments++;
              }
            }
          }
        }
      }

      await supabaseAdmin.from("qbo_sync_logs").insert({
        user_id: userId,
        sync_type: "payments",
        direction: "pull",
        status: "success",
        records_processed: matchedPayments,
        details: { total_qbo_payments: payments.length, matched: matchedPayments },
      });

      return new Response(
        JSON.stringify({ success: true, total_payments: payments.length, matched: matchedPayments }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("QBO sync error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});