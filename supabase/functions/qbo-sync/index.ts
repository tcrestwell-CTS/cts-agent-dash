import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";

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

  const qboBase = `${QBO_BASE}/${connection.realm_id}`;
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
            // First, check if a customer with this DisplayName already exists in QBO
            const displayNameEscaped = customerData.DisplayName.replace(/'/g, "\\'");
            const searchResp = await fetch(
              `${qboBase}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${displayNameEscaped}'`)}`,
              { headers: qboHeaders }
            );
            let existingCustomer: any = null;
            if (searchResp.ok) {
              const searchData = await searchResp.json();
              const matches = searchData.QueryResponse?.Customer || [];
              if (matches.length > 0) {
                existingCustomer = matches[0];
              }
            }

            if (existingCustomer) {
              // Customer already exists in QBO — just create the mapping
              await supabaseAdmin.from("qbo_client_mappings").insert({
                user_id: userId,
                client_id: client.id,
                qbo_customer_id: existingCustomer.Id,
              });
              created++;
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
          const displayNameEscaped = displayName.replace(/'/g, "\\'");
          
          // Check if customer already exists in QBO
          const searchResp = await fetch(
            `${qboBase}/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${displayNameEscaped}'`)}`,
            { headers: qboHeaders }
          );
          let existingCustomer: any = null;
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const matches = searchData.QueryResponse?.Customer || [];
            if (matches.length > 0) existingCustomer = matches[0];
          }

          if (existingCustomer) {
            qboCustomerId = existingCustomer.Id;
            await supabaseAdmin.from("qbo_client_mappings").insert({
              user_id: userId,
              client_id: invoice.client_id,
              qbo_customer_id: qboCustomerId!,
            });
          } else {
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

    // ── POST ?action=create-vendor ──────────────────────────────────
    if (urlPath === "create-vendor" && req.method === "POST") {
      const { supplier_id } = await req.json();
      if (!supplier_id) {
        return new Response(JSON.stringify({ error: "supplier_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: supplier, error: supError } = await supabaseAdmin
        .from("suppliers")
        .select("*")
        .eq("id", supplier_id)
        .eq("user_id", userId)
        .single();
      if (supError || !supplier) {
        return new Response(JSON.stringify({ error: "Supplier not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const displayName = supplier.name.substring(0, 100);
      const displayNameEscaped = displayName.replace(/'/g, "\\'");

      // Check if vendor already exists in QBO
      const searchResp = await fetch(
        `${qboBase}/query?query=${encodeURIComponent(`SELECT * FROM Vendor WHERE DisplayName = '${displayNameEscaped}'`)}`,
        { headers: qboHeaders }
      );
      let existingVendor: any = null;
      if (searchResp.ok) {
        const searchData = await searchResp.json();
        const matches = searchData.QueryResponse?.Vendor || [];
        if (matches.length > 0) existingVendor = matches[0];
      }

      let qboVendorId: string;
      if (existingVendor) {
        qboVendorId = existingVendor.Id;
      } else {
        const vendorData: any = {
          DisplayName: displayName,
          CompanyName: displayName,
        };
        if (supplier.contact_email) vendorData.PrimaryEmailAddr = { Address: supplier.contact_email.substring(0, 100) };
        if (supplier.contact_phone) vendorData.PrimaryPhone = { FreeFormNumber: supplier.contact_phone.substring(0, 30) };
        if (supplier.website) vendorData.WebAddr = { URI: supplier.website.substring(0, 1000) };

        const createResp = await fetch(`${qboBase}/vendor`, {
          method: "POST", headers: qboHeaders, body: JSON.stringify(vendorData),
        });
        if (!createResp.ok) {
          const errText = await createResp.text();
          console.error("QBO vendor creation failed:", errText);
          await supabaseAdmin.from("qbo_sync_logs").insert({
            user_id: userId, sync_type: "vendor", direction: "push", status: "error",
            error_message: errText.substring(0, 500),
          });
          return new Response(
            JSON.stringify({ error: "Failed to create QBO vendor", details: errText }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const result = await createResp.json();
        qboVendorId = result.Vendor.Id;
      }

      await supabaseAdmin.from("qbo_sync_logs").insert({
        user_id: userId, sync_type: "vendor", direction: "push", status: "success", records_processed: 1,
        details: { supplier_id, qbo_vendor_id: qboVendorId, existed: !!existingVendor },
      });

      return new Response(
        JSON.stringify({ success: true, qbo_vendor_id: qboVendorId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── POST ?action=create-bill ────────────────────────────────────
    if (urlPath === "create-bill" && req.method === "POST") {
      const { vendor_ref, line_items, txn_date, due_date } = await req.json();
      if (!vendor_ref || !line_items?.length) {
        return new Response(JSON.stringify({ error: "vendor_ref and line_items required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const billData: any = {
        VendorRef: { value: vendor_ref },
        TxnDate: txn_date || new Date().toISOString().split("T")[0],
        Line: line_items.map((item: any) => ({
          Amount: item.amount,
          DetailType: "AccountBasedExpenseLineDetail",
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: item.account_ref || "1" },
          },
          Description: item.description || "Travel service",
        })),
      };
      if (due_date) billData.DueDate = due_date;

      const createResp = await fetch(`${qboBase}/bill`, {
        method: "POST", headers: qboHeaders, body: JSON.stringify(billData),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        console.error("QBO bill creation failed:", errText);
        await supabaseAdmin.from("qbo_sync_logs").insert({
          user_id: userId, sync_type: "bill", direction: "push", status: "error",
          error_message: errText.substring(0, 500),
        });
        return new Response(
          JSON.stringify({ error: "Failed to create QBO bill", details: errText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await createResp.json();
      await supabaseAdmin.from("qbo_sync_logs").insert({
        user_id: userId, sync_type: "bill", direction: "push", status: "success", records_processed: 1,
        details: { qbo_bill_id: result.Bill.Id },
      });

      return new Response(
        JSON.stringify({ success: true, qbo_bill_id: result.Bill.Id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── POST ?action=create-journal-entry ────────────────────────────
    if (urlPath === "create-journal-entry" && req.method === "POST") {
      const { lines, txn_date, memo } = await req.json();
      if (!lines?.length) {
        return new Response(JSON.stringify({ error: "lines required (array of debit/credit entries)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const journalEntry: any = {
        TxnDate: txn_date || new Date().toISOString().split("T")[0],
        Line: lines.map((line: any) => ({
          Amount: line.amount,
          DetailType: "JournalEntryLineDetail",
          JournalEntryLineDetail: {
            PostingType: line.posting_type, // "Debit" or "Credit"
            AccountRef: { value: line.account_ref },
          },
          Description: line.description || "",
        })),
      };
      if (memo) journalEntry.PrivateNote = memo;

      const createResp = await fetch(`${qboBase}/journalentry`, {
        method: "POST", headers: qboHeaders, body: JSON.stringify(journalEntry),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        console.error("QBO journal entry creation failed:", errText);
        await supabaseAdmin.from("qbo_sync_logs").insert({
          user_id: userId, sync_type: "journal_entry", direction: "push", status: "error",
          error_message: errText.substring(0, 500),
        });
        return new Response(
          JSON.stringify({ error: "Failed to create QBO journal entry", details: errText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await createResp.json();
      await supabaseAdmin.from("qbo_sync_logs").insert({
        user_id: userId, sync_type: "journal_entry", direction: "push", status: "success", records_processed: 1,
        details: { qbo_journal_entry_id: result.JournalEntry.Id },
      });

      return new Response(
        JSON.stringify({ success: true, qbo_journal_entry_id: result.JournalEntry.Id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── POST ?action=create-expense ─────────────────────────────────
    if (urlPath === "create-expense" && req.method === "POST") {
      const { account_ref, payment_type, line_items, txn_date, entity_ref, memo } = await req.json();
      if (!account_ref || !line_items?.length) {
        return new Response(JSON.stringify({ error: "account_ref and line_items required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const purchaseData: any = {
        AccountRef: { value: account_ref },
        PaymentType: payment_type || "Cash", // Cash, Check, CreditCard
        TxnDate: txn_date || new Date().toISOString().split("T")[0],
        Line: line_items.map((item: any) => ({
          Amount: item.amount,
          DetailType: "AccountBasedExpenseLineDetail",
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: item.expense_account_ref || "1" },
          },
          Description: item.description || "Expense",
        })),
      };
      if (entity_ref) purchaseData.EntityRef = { value: entity_ref.id, type: entity_ref.type || "Vendor" };
      if (memo) purchaseData.PrivateNote = memo;

      const createResp = await fetch(`${qboBase}/purchase`, {
        method: "POST", headers: qboHeaders, body: JSON.stringify(purchaseData),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        console.error("QBO expense creation failed:", errText);
        await supabaseAdmin.from("qbo_sync_logs").insert({
          user_id: userId, sync_type: "expense", direction: "push", status: "error",
          error_message: errText.substring(0, 500),
        });
        return new Response(
          JSON.stringify({ error: "Failed to create QBO expense", details: errText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await createResp.json();
      await supabaseAdmin.from("qbo_sync_logs").insert({
        user_id: userId, sync_type: "expense", direction: "push", status: "success", records_processed: 1,
        details: { qbo_purchase_id: result.Purchase.Id },
      });

      return new Response(
        JSON.stringify({ success: true, qbo_purchase_id: result.Purchase.Id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── POST ?action=stripe-clearing-flow ──────────────────────────
    // Manual Stripe Clearing account reconciliation:
    // 1. Gross payment → Stripe Clearing
    // 2. Stripe fees deducted from Clearing
    // 3. Net payout from Clearing → Bank
    if (urlPath === "stripe-clearing-flow" && req.method === "POST") {
      const { gross_amount, stripe_fee, net_amount, customer_ref, txn_date, memo } = await req.json();
      if (!gross_amount || stripe_fee == null || !net_amount) {
        return new Response(JSON.stringify({ error: "gross_amount, stripe_fee, and net_amount required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const date = txn_date || new Date().toISOString().split("T")[0];
      const note = memo || "Stripe/Affirm deposit";
      const results: string[] = [];

      // Step 1: Gross → Stripe Clearing
      const step1 = {
        TxnDate: date,
        PrivateNote: `${note} – Gross received`,
        Line: [
          {
            Amount: gross_amount, DetailType: "JournalEntryLineDetail",
            JournalEntryLineDetail: { PostingType: "Debit", AccountRef: { name: "Stripe Clearing" } },
            Description: `Gross payment received`,
          },
          {
            Amount: gross_amount, DetailType: "JournalEntryLineDetail",
            JournalEntryLineDetail: {
              PostingType: "Credit",
              AccountRef: { name: "Accounts Receivable (A/R)" },
              ...(customer_ref ? { EntityRef: { value: customer_ref, type: "Customer" } } : {}),
            },
            Description: `Gross payment received`,
          },
        ],
      };
      const r1 = await fetch(`${qboBase}/journalentry`, { method: "POST", headers: qboHeaders, body: JSON.stringify(step1) });
      if (!r1.ok) {
        const err = await r1.text();
        throw new Error(`Stripe Clearing step 1 failed: ${err}`);
      }
      results.push((await r1.json()).JournalEntry.Id);

      // Step 2: Fees
      const step2 = {
        TxnDate: date,
        PrivateNote: `${note} – Processing fees`,
        Line: [
          {
            Amount: stripe_fee, DetailType: "JournalEntryLineDetail",
            JournalEntryLineDetail: { PostingType: "Debit", AccountRef: { name: "Stripe Processing Fees" } },
            Description: `Stripe/Affirm processing fee`,
          },
          {
            Amount: stripe_fee, DetailType: "JournalEntryLineDetail",
            JournalEntryLineDetail: { PostingType: "Credit", AccountRef: { name: "Stripe Clearing" } },
            Description: `Stripe/Affirm processing fee`,
          },
        ],
      };
      const r2 = await fetch(`${qboBase}/journalentry`, { method: "POST", headers: qboHeaders, body: JSON.stringify(step2) });
      if (!r2.ok) {
        const err = await r2.text();
        throw new Error(`Stripe Clearing step 2 failed: ${err}`);
      }
      results.push((await r2.json()).JournalEntry.Id);

      // Step 3: Net → Bank
      const step3 = {
        TxnDate: date,
        PrivateNote: `${note} – Net payout to bank`,
        Line: [
          {
            Amount: net_amount, DetailType: "JournalEntryLineDetail",
            JournalEntryLineDetail: { PostingType: "Debit", AccountRef: { name: "Checking" } },
            Description: `Net Stripe payout to bank`,
          },
          {
            Amount: net_amount, DetailType: "JournalEntryLineDetail",
            JournalEntryLineDetail: { PostingType: "Credit", AccountRef: { name: "Stripe Clearing" } },
            Description: `Net Stripe payout to bank`,
          },
        ],
      };
      const r3 = await fetch(`${qboBase}/journalentry`, { method: "POST", headers: qboHeaders, body: JSON.stringify(step3) });
      if (!r3.ok) {
        const err = await r3.text();
        throw new Error(`Stripe Clearing step 3 failed: ${err}`);
      }
      results.push((await r3.json()).JournalEntry.Id);

      await supabaseAdmin.from("qbo_sync_logs").insert({
        user_id: userId, sync_type: "stripe_clearing", direction: "push", status: "success",
        records_processed: 3,
        details: { gross_amount, stripe_fee, net_amount, journal_entry_ids: results },
      });

      return new Response(
        JSON.stringify({ success: true, journal_entry_ids: results, gross_amount, stripe_fee, net_amount }),
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