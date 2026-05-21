import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsPDF } from 'https://esm.sh/jspdf@2.5.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const money = (n: number) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const NAVY: [number, number, number] = [11, 27, 61];
const GOLD: [number, number, number] = [201, 168, 76];

function periodRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  return { startISO: start.toISOString(), endISO: end.toISOString(),
           startDate: start.toISOString().slice(0,10),
           endDate: end.toISOString().slice(0,10) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Confirm admin
    const { data: roleRow } = await userClient
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const period_year = Number(body.period_year);
    const period_month = Number(body.period_month);
    const packet_id: string | undefined = body.packet_id;

    if (!period_year || !period_month || period_month < 1 || period_month > 12) {
      return new Response(JSON.stringify({ error: 'period_year and period_month required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { startISO, endISO, startDate, endDate } = periodRange(period_year, period_month);

    // Ensure a financial_packets row exists (create if missing)
    let packetRowId = packet_id;
    if (!packetRowId) {
      const { data: newRow } = await svc.from('financial_packets').insert({
        period_year, period_month, generated_by: user.id, status: 'generating',
      }).select('id').single();
      packetRowId = newRow?.id;
    }

    // ── Gather data ──────────────────────────────────────────────────────────
    // Income: trip_payments paid in period
    const { data: incomePayments } = await svc
      .from('trip_payments')
      .select('amount, payment_date, processing_fee')
      .eq('status', 'paid')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);
    const totalIncome = (incomePayments || []).reduce((s, p: any) => s + Number(p.amount || 0), 0);
    const totalStripeFees = (incomePayments || []).reduce((s, p: any) => s + Number(p.processing_fee || 0), 0);

    // COGS: bookings supplier_payout for bookings supplier-paid in period
    const { data: paidBookings } = await svc
      .from('bookings')
      .select('supplier_payout, supplier_paid_amount, supplier_paid_date')
      .eq('supplier_paid_status', 'paid')
      .gte('supplier_paid_date', startDate)
      .lte('supplier_paid_date', endDate);
    const totalCOGS = (paidBookings || []).reduce(
      (s, b: any) => s + Number(b.supplier_paid_amount || b.supplier_payout || 0), 0);

    const grossProfit = totalIncome - totalCOGS;
    const netIncome = grossProfit - totalStripeFees;

    // AR: outstanding invoices
    const { data: invoices } = await svc
      .from('invoices')
      .select('amount_remaining, invoice_date, client_name, total_amount')
      .gt('amount_remaining', 0);
    const today = new Date();
    const buckets = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90: 0, total: 0 };
    for (const inv of (invoices || []) as any[]) {
      const rem = Number(inv.amount_remaining || 0);
      buckets.total += rem;
      const dt = inv.invoice_date ? new Date(inv.invoice_date) : null;
      const days = dt ? Math.max(0, Math.floor((today.getTime() - dt.getTime()) / 86400000)) : 0;
      if (days <= 0) buckets.current += rem;
      else if (days <= 30) buckets.b1_30 += rem;
      else if (days <= 60) buckets.b31_60 += rem;
      else if (days <= 90) buckets.b61_90 += rem;
      else buckets.b90 += rem;
    }

    // AP: unpaid supplier bookings
    const { data: apBookings } = await svc
      .from('bookings')
      .select('supplier_payout, return_date:trip_id, created_at, status, supplier_paid_status')
      .neq('supplier_paid_status', 'paid')
      .in('status', ['confirmed', 'completed']);
    const apBuckets = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90: 0, total: 0 };
    for (const b of (apBookings || []) as any[]) {
      const amt = Number(b.supplier_payout || 0);
      apBuckets.total += amt;
      const baseDate = b.created_at ? new Date(b.created_at) : today;
      const due = new Date(baseDate.getTime() + 45 * 86400000);
      const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
      if (days <= 0) apBuckets.current += amt;
      else if (days <= 30) apBuckets.b1_30 += amt;
      else if (days <= 60) apBuckets.b31_60 += amt;
      else if (days <= 90) apBuckets.b61_90 += amt;
      else apBuckets.b90 += amt;
    }

    // Commission register
    const { data: commissions } = await svc
      .from('commissions')
      .select('agent_share, gross_commission, agent_id, paid_date, commission_tier, agent_name')
      .gte('paid_date', startDate)
      .lte('paid_date', endDate);

    // ── PDF ──────────────────────────────────────────────────────────────────
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 50;

    const drawHeader = (title: string) => {
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageW, 60, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Crestwell Travel Services', margin, 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(title, margin, 46);
      doc.setFillColor(...GOLD);
      doc.rect(0, 60, pageW, 3, 'F');
      doc.setTextColor(0, 0, 0);
    };

    const drawFooter = (pageNum: number) => {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Page ${pageNum}`, pageW - margin, pageH - 24, { align: 'right' });
      doc.text('Confidential — Crestwell Travel Services LLC', margin, pageH - 24);
      doc.setTextColor(0);
    };

    const periodLabel = `${MONTHS[period_month - 1]} ${period_year}`;
    let pageNum = 1;

    // Cover
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, pageH / 2 - 2, pageW, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text('Financial Report', pageW / 2, pageH / 2 - 60, { align: 'center' });
    doc.setFontSize(20);
    doc.text(periodLabel, pageW / 2, pageH / 2 - 24, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Crestwell Travel Services LLC', pageW / 2, pageH / 2 + 36, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated ${new Date().toLocaleString('en-US')}`, pageW / 2, pageH / 2 + 56, { align: 'center' });
    doc.setTextColor(0);
    drawFooter(pageNum);

    const newSection = (title: string) => {
      doc.addPage();
      pageNum += 1;
      drawHeader(title);
      drawFooter(pageNum);
      return 90;
    };

    const row = (y: number, label: string, value: string, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(11);
      doc.text(label, margin, y);
      doc.text(value, pageW - margin, y, { align: 'right' });
      return y + 18;
    };

    // P&L
    let y = newSection(`Profit & Loss — ${periodLabel}`);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Income', margin, y); y += 20;
    y = row(y, 'Client Payments Received', money(totalIncome));
    y = row(y, 'Total Income', money(totalIncome), true); y += 10;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Cost of Goods Sold', margin, y); y += 20;
    y = row(y, 'Supplier Payouts', money(totalCOGS));
    y = row(y, 'Total COGS', money(totalCOGS), true); y += 10;
    y = row(y, 'Gross Profit', money(grossProfit), true); y += 14;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Expenses', margin, y); y += 20;
    y = row(y, 'Stripe Processing Fees', money(totalStripeFees));
    y = row(y, 'Total Expenses', money(totalStripeFees), true); y += 14;
    doc.setDrawColor(...GOLD); doc.setLineWidth(1.2);
    doc.line(margin, y, pageW - margin, y); y += 16;
    y = row(y, 'Net Income', money(netIncome), true);

    // Balance Sheet (simplified)
    y = newSection(`Balance Sheet — as of ${endDate}`);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Assets', margin, y); y += 20;
    y = row(y, 'Accounts Receivable (Outstanding Invoices)', money(buckets.total));
    y = row(y, 'Total Assets', money(buckets.total), true); y += 14;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Liabilities', margin, y); y += 20;
    y = row(y, 'Accounts Payable (Unpaid Supplier Bookings)', money(apBuckets.total));
    y = row(y, 'Total Liabilities', money(apBuckets.total), true); y += 14;
    doc.setFontSize(9); doc.setTextColor(120); doc.setFont('helvetica', 'italic');
    doc.text('Note: Full QBO account balances available in the Trial Balance report.', margin, y);
    doc.setTextColor(0);

    // AR Aging
    y = newSection(`Accounts Receivable Aging — as of ${endDate}`);
    y = row(y, 'Current (not yet due)', money(buckets.current));
    y = row(y, '1–30 days overdue', money(buckets.b1_30));
    y = row(y, '31–60 days overdue', money(buckets.b31_60));
    y = row(y, '61–90 days overdue', money(buckets.b61_90));
    y = row(y, '90+ days overdue', money(buckets.b90));
    doc.setDrawColor(...GOLD); doc.line(margin, y, pageW - margin, y); y += 16;
    y = row(y, 'Total AR Outstanding', money(buckets.total), true);
    y += 20;
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`${(invoices || []).length} outstanding invoice(s)`, margin, y);
    doc.setTextColor(0);

    // AP Aging
    y = newSection(`Accounts Payable Aging — as of ${endDate}`);
    y = row(y, 'Current (not yet due)', money(apBuckets.current));
    y = row(y, '1–30 days overdue', money(apBuckets.b1_30));
    y = row(y, '31–60 days overdue', money(apBuckets.b31_60));
    y = row(y, '61–90 days overdue', money(apBuckets.b61_90));
    y = row(y, '90+ days overdue', money(apBuckets.b90));
    doc.setDrawColor(...GOLD); doc.line(margin, y, pageW - margin, y); y += 16;
    y = row(y, 'Total AP Outstanding', money(apBuckets.total), true);
    y += 20;
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`${(apBookings || []).length} unpaid supplier booking(s)`, margin, y);
    doc.setTextColor(0);

    // Commission Register
    y = newSection(`Commission Register — ${periodLabel}`);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Agent', margin, y);
    doc.text('Tier', margin + 200, y);
    doc.text('Gross', margin + 290, y, { align: 'right' });
    doc.text('Agent Share', pageW - margin, y, { align: 'right' });
    y += 6;
    doc.setDrawColor(200); doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y); y += 14;
    doc.setFont('helvetica', 'normal');
    let grossSum = 0, shareSum = 0;
    for (const c of (commissions || []) as any[]) {
      if (y > pageH - 80) { y = newSection(`Commission Register — ${periodLabel} (cont.)`); }
      const gross = Number(c.gross_commission || 0);
      const share = Number(c.agent_share || 0);
      grossSum += gross; shareSum += share;
      doc.text(String(c.agent_name || c.agent_id || '—').slice(0, 32), margin, y);
      doc.text(String(c.commission_tier || '—'), margin + 200, y);
      doc.text(money(gross), margin + 290, y, { align: 'right' });
      doc.text(money(share), pageW - margin, y, { align: 'right' });
      y += 14;
    }
    y += 6; doc.setDrawColor(...GOLD); doc.setLineWidth(1);
    doc.line(margin, y, pageW - margin, y); y += 16;
    doc.setFont('helvetica', 'bold');
    doc.text('Totals', margin, y);
    doc.text(money(grossSum), margin + 290, y, { align: 'right' });
    doc.text(money(shareSum), pageW - margin, y, { align: 'right' });

    // Output PDF
    const pdfBytes = doc.output('arraybuffer');
    const ts = Date.now();
    const path = `${period_year}/${String(period_month).padStart(2,'0')}/financial-packet-${ts}.pdf`;

    const { error: uploadErr } = await svc.storage.from('financial-packets')
      .upload(path, new Uint8Array(pdfBytes), { contentType: 'application/pdf', upsert: true });

    if (uploadErr) {
      await svc.from('financial_packets').update({ status: 'failed' }).eq('id', packetRowId!);
      return new Response(JSON.stringify({ error: 'Upload failed', detail: uploadErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await svc.from('financial_packets').update({
      status: 'ready', storage_path: path,
    }).eq('id', packetRowId!);

    return new Response(JSON.stringify({
      ok: true, packet_id: packetRowId, storage_path: path,
      totals: { income: totalIncome, cogs: totalCOGS, net: netIncome,
                ar: buckets.total, ap: apBuckets.total,
                commission_count: (commissions || []).length },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('generate-financial-packet error', e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});