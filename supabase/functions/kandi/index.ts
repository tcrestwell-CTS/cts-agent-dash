// =============================================================================
// KANDI — Agent 5: Revenue/Admin Sync Checker
// =============================================================================
// Reconciliation & exception detector between CRM and QuickBooks Online.
// Modes:
//   POST { trigger: "booking_change", record, old_record }
//   POST { trigger: "invoice_change", record, old_record }
//   POST { trigger: "commission_change", record, old_record }
//   POST { trigger: "daily_sweep" }  — full scan (pg_cron, 6 AM UTC)
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPA_SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const sb = createClient(SUPA_URL, SUPA_SVC);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS });
  }

  const { trigger, record, old_record } = body;
  if (!trigger) {
    return new Response(JSON.stringify({ error: 'Missing trigger' }), { status: 400, headers: CORS });
  }

  const alerts: Array<{
    user_id: string;
    alert_type: string;
    severity: string;
    entity_type: string;
    entity_id: string;
    title: string;
    description: string;
    metadata?: Record<string, unknown>;
  }> = [];

  try {
    switch (trigger) {
      case 'booking_change':
        await checkBooking(sb, record, old_record, alerts);
        break;
      case 'invoice_change':
        await checkInvoice(sb, record, old_record, alerts);
        break;
      case 'commission_change':
        await checkCommission(sb, record, old_record, alerts);
        break;
      case 'daily_sweep':
        await dailySweep(sb, alerts);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown trigger: ${trigger}` }), { status: 400, headers: CORS });
    }

    // Deduplicate: don't re-raise an unresolved alert for the same entity+type
    const toInsert: typeof alerts = [];
    for (const a of alerts) {
      const { data: existing } = await sb
        .from('reconciliation_alerts')
        .select('id')
        .eq('user_id', a.user_id)
        .eq('alert_type', a.alert_type)
        .eq('entity_id', a.entity_id)
        .eq('resolved', false)
        .maybeSingle();

      if (!existing) toInsert.push(a);
    }

    if (toInsert.length > 0) {
      const { error: insertErr } = await sb
        .from('reconciliation_alerts')
        .insert(toInsert);

      if (insertErr) console.error('Failed to insert alerts:', insertErr);

      // Also push agent notifications for critical/warning alerts
      const notifications = toInsert
        .filter(a => a.severity !== 'info')
        .map(a => ({
          user_id: a.user_id,
          type: 'reconciliation_alert',
          title: `🔍 Kandi: ${a.title}`,
          message: a.description,
        }));

      if (notifications.length > 0) {
        await sb.from('agent_notifications').insert(notifications);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      trigger,
      alerts_raised: toInsert.length,
    }), { headers: CORS });

  } catch (err) {
    console.error('Kandi error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});

// ─── Check: Booking Changes ─────────────────────────────────────────────────
async function checkBooking(
  sb: any,
  record: any,
  _old: any,
  alerts: any[]
) {
  const userId = record.user_id;
  const bookingId = record.id;

  // 1. Confirmed booking without an invoice
  if (record.status === 'confirmed') {
    const { data: invoice } = await sb
      .from('invoices')
      .select('id')
      .eq('user_id', userId)
      .or(`trip_id.eq.${record.trip_id}`)
      .maybeSingle();

    if (!invoice) {
      alerts.push({
        user_id: userId,
        alert_type: 'missing_invoice',
        severity: 'warning',
        entity_type: 'booking',
        entity_id: bookingId,
        title: 'Confirmed booking has no invoice',
        description: `Booking ${record.confirmation_number} is confirmed but no invoice has been generated.`,
        metadata: { confirmation_number: record.confirmation_number, trip_id: record.trip_id },
      });
    }
  }

  // 2. Booking has gross_sales > 0 but commission_revenue is 0 and has a supplier
  if (record.gross_sales > 0 && record.commission_revenue === 0 && record.supplier_id) {
    alerts.push({
      user_id: userId,
      alert_type: 'commission_variance',
      severity: 'info',
      entity_type: 'booking',
      entity_id: bookingId,
      title: 'Zero commission on revenue booking',
      description: `Booking ${record.confirmation_number} has $${record.gross_sales} gross sales but $0 commission. Verify supplier rate.`,
      metadata: { gross_sales: record.gross_sales, supplier_id: record.supplier_id },
    });
  }

  // 3. Status went to 'completed' — check QBO sync log exists
  if (record.status === 'confirmed' && record.trip_id) {
    const { data: syncLog } = await sb
      .from('qbo_sync_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('sync_type', 'booking_confirmed')
      .eq('status', 'success')
      .limit(1);

    // If QBO connection exists but no sync log, flag it
    const { data: qboConn } = await sb
      .from('qbo_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (qboConn && (!syncLog || syncLog.length === 0)) {
      alerts.push({
        user_id: userId,
        alert_type: 'qbo_desync',
        severity: 'warning',
        entity_type: 'booking',
        entity_id: bookingId,
        title: 'Booking not synced to QuickBooks',
        description: `Booking ${record.confirmation_number} is confirmed but no successful QBO sync was recorded.`,
        metadata: { confirmation_number: record.confirmation_number },
      });
    }
  }
}

// ─── Check: Invoice Changes ─────────────────────────────────────────────────
async function checkInvoice(
  sb: any,
  record: any,
  _old: any,
  alerts: any[]
) {
  const userId = record.user_id;

  // 1. Invoice with amount_remaining > 0 and status still 'sent' for over 30 days
  if (record.status === 'sent' && record.amount_remaining > 0) {
    const invoiceDate = new Date(record.invoice_date);
    const daysSince = (Date.now() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince > 30) {
      alerts.push({
        user_id: userId,
        alert_type: 'unpaid_balance',
        severity: 'critical',
        entity_type: 'invoice',
        entity_id: record.id,
        title: 'Invoice unpaid for 30+ days',
        description: `Invoice ${record.invoice_number} has $${record.amount_remaining} remaining and was sent ${Math.floor(daysSince)} days ago.`,
        metadata: {
          invoice_number: record.invoice_number,
          amount_remaining: record.amount_remaining,
          days_since_sent: Math.floor(daysSince),
        },
      });
    }
  }
}

// ─── Check: Commission Changes ──────────────────────────────────────────────
async function checkCommission(
  sb: any,
  record: any,
  old_record: any,
  alerts: any[]
) {
  const userId = record.user_id;

  // 1. Commission expected vs actual variance > 10%
  if (record.expected_commission && record.amount) {
    const variance = Math.abs(record.expected_commission - record.amount);
    const pct = (variance / record.expected_commission) * 100;

    if (pct > 10) {
      alerts.push({
        user_id: userId,
        alert_type: 'commission_variance',
        severity: 'warning',
        entity_type: 'commission',
        entity_id: record.id,
        title: 'Commission variance exceeds 10%',
        description: `Expected $${record.expected_commission} but received $${record.amount} (${pct.toFixed(1)}% variance).`,
        metadata: {
          expected: record.expected_commission,
          actual: record.amount,
          variance_pct: pct,
          booking_id: record.booking_id,
        },
      });
    }
  }

  // 2. Commission pending for > 60 days
  if (record.status === 'pending') {
    const created = new Date(record.created_at);
    const daysPending = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);

    if (daysPending > 60) {
      alerts.push({
        user_id: userId,
        alert_type: 'commission_variance',
        severity: 'critical',
        entity_type: 'commission',
        entity_id: record.id,
        title: 'Commission pending 60+ days',
        description: `Commission of $${record.amount} has been pending for ${Math.floor(daysPending)} days.`,
        metadata: { amount: record.amount, days_pending: Math.floor(daysPending) },
      });
    }
  }
}

// ─── Daily Sweep: Full Reconciliation Scan ──────────────────────────────────
async function dailySweep(sb: any, alerts: any[]) {
  // Get all active users (those with profiles)
  const { data: profiles } = await sb
    .from('profiles')
    .select('user_id')
    .limit(200);

  if (!profiles || profiles.length === 0) return;

  for (const profile of profiles) {
    const userId = profile.user_id;

    // ── 1. Confirmed bookings without invoices ──
    const { data: confirmedBookings } = await sb
      .from('bookings')
      .select('id, confirmation_number, trip_id, gross_sales')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .limit(100);

    if (confirmedBookings) {
      for (const b of confirmedBookings) {
        if (!b.trip_id) continue;

        const { data: inv } = await sb
          .from('invoices')
          .select('id')
          .eq('user_id', userId)
          .eq('trip_id', b.trip_id)
          .maybeSingle();

        if (!inv) {
          alerts.push({
            user_id: userId,
            alert_type: 'missing_invoice',
            severity: 'warning',
            entity_type: 'booking',
            entity_id: b.id,
            title: 'Confirmed booking missing invoice',
            description: `Booking ${b.confirmation_number} (Trip: ${b.trip_id}) has no linked invoice.`,
            metadata: { confirmation_number: b.confirmation_number },
          });
        }
      }
    }

    // ── 2. Invoices unpaid 30+ days ──
    const { data: oldInvoices } = await sb
      .from('invoices')
      .select('id, invoice_number, amount_remaining, invoice_date')
      .eq('user_id', userId)
      .eq('status', 'sent')
      .gt('amount_remaining', 0)
      .limit(100);

    if (oldInvoices) {
      for (const inv of oldInvoices) {
        const days = (Date.now() - new Date(inv.invoice_date).getTime()) / 86400000;
        if (days > 30) {
          alerts.push({
            user_id: userId,
            alert_type: 'unpaid_balance',
            severity: 'critical',
            entity_type: 'invoice',
            entity_id: inv.id,
            title: 'Invoice unpaid 30+ days',
            description: `Invoice ${inv.invoice_number}: $${inv.amount_remaining} remaining (${Math.floor(days)} days).`,
          });
        }
      }
    }

    // ── 3. Trips with status mismatch (booked in CRM but bookings cancelled) ──
    const { data: bookedTrips } = await sb
      .from('trips')
      .select('id, trip_name, status')
      .eq('user_id', userId)
      .eq('status', 'booked')
      .limit(100);

    if (bookedTrips) {
      for (const trip of bookedTrips) {
        const { data: activeBookings } = await sb
          .from('bookings')
          .select('id')
          .eq('trip_id', trip.id)
          .not('status', 'in', '("cancelled","archived")')
          .limit(1);

        if (!activeBookings || activeBookings.length === 0) {
          alerts.push({
            user_id: userId,
            alert_type: 'status_mismatch',
            severity: 'critical',
            entity_type: 'trip',
            entity_id: trip.id,
            title: 'Booked trip has no active bookings',
            description: `Trip "${trip.trip_name}" is marked as booked but all bookings are cancelled/archived.`,
          });
        }
      }
    }

    // ── 4. Commissions pending > 60 days ──
    const { data: staleCommissions } = await sb
      .from('commissions')
      .select('id, amount, created_at, booking_id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .limit(100);

    if (staleCommissions) {
      for (const c of staleCommissions) {
        const days = (Date.now() - new Date(c.created_at).getTime()) / 86400000;
        if (days > 60) {
          alerts.push({
            user_id: userId,
            alert_type: 'commission_variance',
            severity: 'critical',
            entity_type: 'commission',
            entity_id: c.id,
            title: 'Commission pending 60+ days',
            description: `$${c.amount} commission pending for ${Math.floor(days)} days.`,
            metadata: { booking_id: c.booking_id },
          });
        }
      }
    }

    // ── 5. QBO desync check: confirmed bookings without sync logs ──
    const { data: qboConn } = await sb
      .from('qbo_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (qboConn && confirmedBookings) {
      for (const b of confirmedBookings) {
        const { data: syncLog } = await sb
          .from('qbo_sync_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('sync_type', 'booking_confirmed')
          .eq('status', 'success')
          .limit(1);

        if (!syncLog || syncLog.length === 0) {
          alerts.push({
            user_id: userId,
            alert_type: 'qbo_desync',
            severity: 'warning',
            entity_type: 'booking',
            entity_id: b.id,
            title: 'Booking not synced to QuickBooks',
            description: `Booking ${b.confirmation_number} has no successful QBO sync record.`,
          });
        }
      }
    }

    // ── 6. Deposit due dates: trips with upcoming payments not yet received ──
    const { data: upcomingPayments } = await sb
      .from('trip_payments')
      .select('id, trip_id, amount, due_date, status')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .limit(100);

    if (upcomingPayments) {
      for (const p of upcomingPayments) {
        const dueDate = new Date(p.due_date);
        const daysUntilDue = (dueDate.getTime() - Date.now()) / 86400000;

        if (daysUntilDue < 0) {
          alerts.push({
            user_id: userId,
            alert_type: 'deposit_overdue',
            severity: 'critical',
            entity_type: 'payment',
            entity_id: p.id,
            title: 'Payment overdue',
            description: `$${p.amount} payment was due ${Math.abs(Math.floor(daysUntilDue))} days ago.`,
            metadata: { trip_id: p.trip_id, amount: p.amount },
          });
        }
      }
    }
  }
}
