// =============================================================================
// parse-booking-confirmation — Edge Function
// Accepts a base64-encoded PDF of a cruise line booking confirmation,
// extracts financial data using Claude, compares against the CRM booking,
// and writes a reconciliation record to booking_confirmations.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPA_URL    = Deno.env.get('SUPABASE_URL')!;
const SUPA_SVC    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC   = Deno.env.get('ANTHROPIC_API_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// Tolerance for reconciliation — amounts within this are "matched"
const MATCH_TOLERANCE = 1.00;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const {
      booking_id,
      pdf_base64,     // base64-encoded PDF bytes
      pdf_filename,
    } = await req.json();

    if (!booking_id || !pdf_base64) {
      return new Response(
        JSON.stringify({ error: 'booking_id and pdf_base64 are required' }),
        { status: 400, headers: CORS }
      );
    }

    const sb = createClient(SUPA_URL, SUPA_SVC);

    // ── 1. Load the booking from CRM ────────────────────────────────────
    const { data: booking, error: bookingErr } = await sb
      .from('bookings')
      .select('id, user_id, gross_sales, commission_revenue, supplier_payout, confirmation_number, suppliers(name, commission_rate)')
      .eq('id', booking_id)
      .single();

    if (bookingErr || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found', detail: bookingErr?.message }),
        { status: 404, headers: CORS }
      );
    }

    // ── 2. Call Claude to extract financials from the PDF ────────────────
    const extractionPrompt = `You are extracting financial data from a cruise line booking confirmation PDF.

Extract EXACTLY the following fields and return ONLY a JSON object with no other text:

{
  "reservation_id": "string — the cruise line's reservation/booking ID",
  "cruise_line": "string — cruise line name (e.g. Celebrity Cruises, Carnival, Royal Caribbean)",
  "ship": "string — ship name",
  "sailing_date": "string — sailing/departure date in YYYY-MM-DD format",
  "itinerary": "string — itinerary description",
  "stateroom": "string — stateroom number and category",
  "guest_count": number — number of guests,
  "gross_charges": number — total gross charges billed to client (the 'Gross Charges' line, including all discounts applied but BEFORE comm/admin deduction),
  "commission_amount": number — total commission/admin amount (the 'Total Comm/Admin' or 'Comm/Admin' line),
  "commission_rate": number — commission rate as a percentage (e.g. 10 for 10%),
  "net_charges": number — net charges / amount to remit to cruise line (after commission deducted),
  "deposit_due_date": "string — deposit due date in YYYY-MM-DD format if present",
  "final_payment_date": "string — final payment due date in YYYY-MM-DD format if present",
  "taxes_fees": number — taxes fees and port expenses total,
  "promotions": ["array of promotion names applied"]
}

If a field is not found, use null. Numbers must be numeric (no currency symbols or commas).`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdf_base64,
                },
              },
              {
                type: 'text',
                text: extractionPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('Anthropic error:', aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: 'PDF extraction failed', detail: errText }),
        { status: 500, headers: CORS }
      );
    }

    const aiResult = await aiResponse.json();
    const rawText = aiResult.content?.[0]?.text ?? '{}';

    let extracted: Record<string, any> = {};
    try {
      const cleaned = rawText.replace(/```json\n?|```/g, '').trim();
      extracted = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse failed:', rawText);
      return new Response(
        JSON.stringify({ error: 'Failed to parse extraction result', raw: rawText }),
        { status: 500, headers: CORS }
      );
    }

    // ── 3. Reconcile against CRM booking ────────────────────────────────
    const crmGross      = booking.gross_sales            ?? 0;
    const crmCommission = booking.commission_revenue     ?? 0;
    const crmNet        = booking.supplier_payout        ?? 0;

    const extGross      = extracted.gross_charges        ?? 0;
    const extCommission = extracted.commission_amount    ?? 0;
    const extNet        = extracted.net_charges          ?? 0;

    const grossVariance      = Math.abs(extGross      - crmGross);
    const commissionVariance = Math.abs(extCommission - crmCommission);
    const netVariance        = Math.abs(extNet        - crmNet);

    const isMatched =
      grossVariance      <= MATCH_TOLERANCE &&
      commissionVariance <= MATCH_TOLERANCE &&
      netVariance        <= MATCH_TOLERANCE;

    const recon_status = extGross === 0 ? 'pending'
      : isMatched ? 'matched'
      : 'mismatch';

    // ── 4. Write to booking_confirmations ────────────────────────────────
    const { data: confirmation, error: insertErr } = await sb
      .from('booking_confirmations')
      .upsert({
        booking_id,
        user_id:                    booking.user_id,
        pdf_filename:               pdf_filename ?? null,
        extracted_reservation_id:   extracted.reservation_id   ?? null,
        extracted_cruise_line:      extracted.cruise_line       ?? null,
        extracted_ship:             extracted.ship              ?? null,
        extracted_sailing_date:     extracted.sailing_date      ?? null,
        extracted_itinerary:        extracted.itinerary         ?? null,
        extracted_stateroom:        extracted.stateroom         ?? null,
        extracted_guests:           extracted.guest_count       ?? null,
        extracted_gross_charges:    extGross    || null,
        extracted_commission_amount: extCommission || null,
        extracted_commission_rate:  extracted.commission_rate   ?? null,
        extracted_net_charges:      extNet      || null,
        extracted_json:             extracted,
        recon_status,
        gross_variance:             grossVariance,
        commission_variance:        commissionVariance,
        net_variance:               netVariance,
        extracted_at:               new Date().toISOString(),
      }, {
        onConflict: 'booking_id',  // one confirmation per booking (latest wins)
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Insert error:', insertErr);
      return new Response(
        JSON.stringify({ error: 'Failed to save confirmation', detail: insertErr.message }),
        { status: 500, headers: CORS }
      );
    }

    // ── 5. Return result ─────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        confirmation,
        reconciliation: {
          status:               recon_status,
          is_matched:           isMatched,
          crm: {
            gross_sales:       crmGross,
            commission:        crmCommission,
            supplier_payout:   crmNet,
          },
          extracted: {
            gross_charges:     extGross,
            commission_amount: extCommission,
            net_charges:       extNet,
          },
          variances: {
            gross:       grossVariance,
            commission:  commissionVariance,
            net:         netVariance,
          },
        },
      }),
      { headers: CORS }
    );

  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: String(err) }),
      { status: 500, headers: CORS }
    );
  }
});
