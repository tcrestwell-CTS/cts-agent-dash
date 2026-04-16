import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, data } = payload;

    console.log(`Duffel webhook received: ${type}`, JSON.stringify(data).substring(0, 500));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const orderId = data?.order_id || data?.id;
    if (!orderId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no order_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the tracked flight order
    const { data: flightOrder } = await supabase
      .from("flight_orders")
      .select("*")
      .eq("duffel_order_id", orderId)
      .maybeSingle();

    if (!flightOrder) {
      console.log(`No tracked flight order for duffel_order_id: ${orderId}`);
      return new Response(JSON.stringify({ ok: true, skipped: "untracked order" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine event details
    let eventSummary = "";
    let newStatus = flightOrder.order_status;
    let notificationTitle = "";
    let notificationMessage = "";
    const route = `${flightOrder.origin_iata} → ${flightOrder.destination_iata}`;
    const paxNames = (flightOrder.passenger_names || []).join(", ");

    switch (type) {
      case "order.updated":
        eventSummary = "Order details updated by airline";
        notificationTitle = `Flight Update: ${route}`;
        notificationMessage = `Flight ${(flightOrder.flight_numbers || []).join("/")} (${route}) for ${paxNames} has been updated by the airline. Please review the latest details.`;
        break;

      case "order.airline_initiated_change":
      case "order.airline_initiated_change_detected":
        eventSummary = "Airline-initiated schedule change";
        newStatus = "schedule_changed";
        notificationTitle = `⚠️ Schedule Change: ${route}`;
        notificationMessage = `The airline has made a schedule change to flight ${(flightOrder.flight_numbers || []).join("/")} (${route}) for ${paxNames}. Action may be required.`;
        break;

      case "order.cancellation":
      case "order.cancellation.created":
        eventSummary = "Flight cancellation initiated";
        newStatus = "cancelled";
        notificationTitle = `🚨 Flight Cancellation: ${route}`;
        notificationMessage = `Flight ${(flightOrder.flight_numbers || []).join("/")} (${route}) for ${paxNames} cancellation has been initiated.`;
        break;

      case "order.cancellation.confirmed":
        eventSummary = "Flight cancellation confirmed";
        newStatus = "cancelled";
        notificationTitle = `🚨 Flight Cancelled: ${route}`;
        notificationMessage = `Flight ${(flightOrder.flight_numbers || []).join("/")} (${route}) for ${paxNames} has been fully cancelled. Immediate rebooking action required.`;
        break;

      case "order.created":
        eventSummary = "Order created successfully";
        notificationTitle = `✅ Flight Booked: ${route}`;
        notificationMessage = `Flight ${(flightOrder.flight_numbers || []).join("/")} (${route}) for ${paxNames} has been booked successfully.`;
        break;

      case "order.creation_failed":
        eventSummary = "Order creation failed";
        newStatus = "failed";
        notificationTitle = `❌ Booking Failed: ${route}`;
        notificationMessage = `Flight booking for ${route} (${paxNames}) failed. Please retry or contact support.`;
        break;

      case "air.payment.succeeded": {
        eventSummary = "Payment processed successfully";
        notificationTitle = `💳 Payment Confirmed: ${route}`;
        notificationMessage = `Payment for flight ${(flightOrder.flight_numbers || []).join("/")} (${route}) for ${paxNames} was processed successfully.`;

        // Auto-create trip_payments record for the Duffel payment
        if (flightOrder.trip_id && flightOrder.booking_id) {
          const paymentAmount = flightOrder.total_amount || 0;
          const today = new Date().toISOString().split("T")[0];

          // Check if a payment record already exists for this booking
          const { data: existingPayment } = await supabase
            .from("trip_payments")
            .select("id")
            .eq("booking_id", flightOrder.booking_id)
            .eq("status", "paid")
            .maybeSingle();

          if (!existingPayment) {
            await supabase.from("trip_payments").insert({
              trip_id: flightOrder.trip_id,
              booking_id: flightOrder.booking_id,
              user_id: flightOrder.user_id,
              amount: paymentAmount,
              payment_date: today,
              due_date: today,
              payment_type: "payment",
              payment_method: "duffel_balance",
              status: "paid",
              details: `Duffel flight payment – ${(flightOrder.flight_numbers || []).join("/")} (${route})`,
              notes: `Auto-recorded from Duffel webhook. Order: ${orderId}`,
            });
            console.log(`Created trip_payment for booking ${flightOrder.booking_id}, amount: ${paymentAmount}`);
          }
        }
        break;
      }

      case "air.payment.failed":
        eventSummary = "Payment failed";
        notificationTitle = `❌ Payment Failed: ${route}`;
        notificationMessage = `Payment for flight ${(flightOrder.flight_numbers || []).join("/")} (${route}) for ${paxNames} has failed. Please update payment details.`;
        break;

      case "air.payment.cancelled":
        eventSummary = "Payment cancelled";
        notificationTitle = `Payment Cancelled: ${route}`;
        notificationMessage = `Payment for flight ${route} (${paxNames}) was cancelled.`;
        break;

      case "air.payment.pending":
        eventSummary = "Payment pending";
        notificationTitle = `⏳ Payment Pending: ${route}`;
        notificationMessage = `Payment for flight ${route} (${paxNames}) is pending processing.`;
        break;

      case "air.airline_credit.created":
        eventSummary = "Airline credit issued";
        notificationTitle = `🎟️ Airline Credit Issued: ${route}`;
        notificationMessage = `An airline credit has been issued for flight ${route} (${paxNames}). Check your dashboard for details.`;
        break;

      case "air.airline_credit.spent":
        eventSummary = "Airline credit used";
        notificationTitle = `Airline Credit Used: ${route}`;
        notificationMessage = `An airline credit for ${route} (${paxNames}) has been applied to a booking.`;
        break;

      case "air.airline_credit.invalidated":
        eventSummary = "Airline credit invalidated";
        notificationTitle = `⚠️ Airline Credit Expired: ${route}`;
        notificationMessage = `An airline credit for ${route} (${paxNames}) has been invalidated or expired.`;
        break;

      case "payment.created":
        eventSummary = "New payment created";
        notificationTitle = `Payment Created: ${route}`;
        notificationMessage = `A new payment has been created for flight ${route} (${paxNames}).`;
        break;

      default:
        eventSummary = `Event: ${type}`;
        notificationTitle = `Flight Event: ${route}`;
        notificationMessage = `A ${type} event occurred for flight ${route} (${paxNames}).`;
    }

    // Append to event log
    const eventLog = Array.isArray(flightOrder.event_log) ? flightOrder.event_log : [];
    eventLog.push({
      type,
      summary: eventSummary,
      timestamp: new Date().toISOString(),
      raw: data,
    });

    // Update flight order
    await supabase
      .from("flight_orders")
      .update({
        order_status: newStatus,
        last_event_type: type,
        last_event_at: new Date().toISOString(),
        event_log: eventLog,
      })
      .eq("id", flightOrder.id);

    // Create agent notification
    await supabase.from("agent_notifications").insert({
      user_id: flightOrder.user_id,
      type: "flight_alert",
      title: notificationTitle,
      message: notificationMessage,
      trip_id: flightOrder.trip_id,
    });

    // Send email notifications to client passengers
    const passengerEmails = flightOrder.passenger_emails || [];
    for (const email of passengerEmails) {
      if (!email) continue;
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            to: email,
            subject: notificationTitle,
            html: buildFlightAlertEmailHtml({
              title: notificationTitle,
              message: notificationMessage,
              route,
              flightNumbers: (flightOrder.flight_numbers || []).join(", "),
              departureAt: flightOrder.departure_at,
              eventType: type,
            }),
          },
        });
      } catch (emailErr) {
        console.error(`Failed to email ${email}:`, emailErr);
      }
    }

    // Also email the agent
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", flightOrder.user_id)
      .maybeSingle();

    // Get agent email from auth
    const { data: { user: agentUser } } = await supabase.auth.admin.getUserById(flightOrder.user_id);
    if (agentUser?.email) {
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            to: agentUser.email,
            subject: `[Agent Alert] ${notificationTitle}`,
            html: buildFlightAlertEmailHtml({
              title: notificationTitle,
              message: notificationMessage,
              route,
              flightNumbers: (flightOrder.flight_numbers || []).join(", "),
              departureAt: flightOrder.departure_at,
              eventType: type,
              isAgent: true,
              agentName: profile?.full_name,
            }),
          },
        });
      } catch (emailErr) {
        console.error(`Failed to email agent:`, emailErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, event: type, order: orderId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Duffel webhook error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface EmailParams {
  title: string;
  message: string;
  route: string;
  flightNumbers: string;
  departureAt: string | null;
  eventType: string;
  isAgent?: boolean;
  agentName?: string;
}

function buildFlightAlertEmailHtml(params: EmailParams): string {
  const { title, message, route, flightNumbers, departureAt, eventType, isAgent, agentName } = params;

  const alertColor = eventType === "order.cancellation" ? "#dc2626" 
    : eventType === "order.airline_initiated_change" ? "#f59e0b" 
    : "#2563eb";

  const departureFormatted = departureAt 
    ? new Date(departureAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "N/A";

  const bannerTitle = isAgent ? "Agent Flight Alert" : "Flight Notification";
  const alertBadgeColor = eventType === "order.cancellation" ? "#dc2626" 
    : eventType === "order.airline_initiated_change" ? "#f59e0b" 
    : "#2563eb";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px;">
    <div style="background-color: #0D1B2A; padding: 24px 24px 20px; text-align: center;">
      <h1 style="color: #C9A84C; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">✈️ ${bannerTitle}</h1>
    </div>
    <div style="padding: 24px;">
      <div style="display: inline-block; background-color: ${alertBadgeColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">${eventType.replace(/\./g, ' · ').toUpperCase()}</div>
      ${isAgent ? `<p style="color: #666; font-size: 14px;">Hi ${agentName || "Agent"},</p>` : ""}
      <p style="color: #333; font-size: 15px; line-height: 1.6;">${message}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 13px;">Route</td>
          <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${route}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 13px;">Flight(s)</td>
          <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${flightNumbers || "N/A"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 13px;">Departure</td>
          <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${departureFormatted}</td>
        </tr>
      </table>
      ${isAgent 
        ? `<p style="color: #666; font-size: 13px;">Log in to your dashboard to review and take action.</p>`
        : `<p style="color: #666; font-size: 13px;">Your travel advisor has been notified and will reach out if any action is needed on your part.</p>`
      }
    </div>
    <div style="padding: 16px 24px; background: #0D1B2A; text-align: center;">
      <p style="color: #C9A84C; font-size: 12px; margin: 0;">Crestwell Travel Services</p>
    </div>
  </div>
</body>
</html>`;
}
