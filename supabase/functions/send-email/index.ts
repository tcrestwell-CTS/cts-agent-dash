import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Attachment {
  filename: string;
  content: string; // base64 encoded
}

interface EmailRequest {
  to: string;
  subject: string;
  template: "welcome" | "booking_confirmation" | "itinerary" | "quote" | "trip_completed" | "agent_invitation" | "commission_override_approval" | "invoice" | "custom";
  data?: Record<string, string>;
  customHtml?: string;
  clientId?: string;
  attachments?: Attachment[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      throw new Error("Email service not configured");
    }

    const resend = new Resend(RESEND_API_KEY);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Get branding settings
    const { data: branding, error: brandingError } = await supabase
      .from("branding_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (brandingError && brandingError.code !== "PGRST116") {
      console.error("Error fetching branding:", brandingError);
    }

    const { to, subject, template, data: templateData, customHtml, clientId, attachments }: EmailRequest = await req.json();

    if (!to || !subject || !template) {
      throw new Error("Missing required fields: to, subject, template");
    }

    if (template === "custom" && !customHtml) {
      throw new Error("Custom template requires customHtml field");
    }

    // Build email HTML based on template and branding
    const agencyName = branding?.agency_name || "Your Travel Agency";
    const tagline = branding?.tagline || "Your Journey, Our Passion";
    const primaryColor = branding?.primary_color || "#0D7377";
    const accentColor = branding?.accent_color || "#E8763A";
    const logoUrl = branding?.logo_url || "";
    const phone = branding?.phone || "";
    const website = branding?.website || "";
    // Use verified domain for sending emails
    const fromEmail = branding?.from_email || "send@crestwellgetaways.com";
    const fromName = branding?.from_name || agencyName;

    // Build the client portal URL
    let portalBaseUrl = Deno.env.get("PORTAL_BASE_URL") || "https://app.crestwelltravels.com";
    if (!/^https?:\/\//i.test(portalBaseUrl)) {
      portalBaseUrl = `https://${portalBaseUrl}`;
    }
    const portalUrlBase = portalBaseUrl.replace(/\/+$/, '');
    const hasClientPath = new URL(portalUrlBase).pathname.includes("/client");
    const clientPortalUrl = hasClientPath ? portalUrlBase : `${portalUrlBase}/client`;

    const logoHtml = logoUrl 
      ? `<img src="${logoUrl}" alt="${agencyName}" style="max-height: 60px; margin-bottom: 16px;" />`
      : "";

    const footerHtml = `
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
        <p style="margin: 0;">${agencyName}</p>
        ${tagline ? `<p style="margin: 4px 0; font-style: italic;">${tagline}</p>` : ""}
        ${phone ? `<p style="margin: 4px 0;">📞 ${phone}</p>` : ""}
        ${website ? `<p style="margin: 4px 0;"><a href="${website}" style="color: ${primaryColor};">${website}</a></p>` : ""}
        <p style="margin: 8px 0;"><a href="${clientPortalUrl}" style="color: ${primaryColor}; text-decoration: underline;">Access Your Client Portal</a></p>
      </div>
    `;

    let emailHtml = "";
    const clientName = templateData?.clientName || "[Client Name]";

    // Replace {{portal_url}} placeholder in any templateData values
    if (templateData) {
      for (const key of Object.keys(templateData)) {
        if (typeof templateData[key] === "string") {
          templateData[key] = templateData[key].replace(/\{\{portal_url\}\}/g, clientPortalUrl);
        }
      }
    }

    switch (template) {
      case "welcome":
        emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              ${logoHtml}
              <h1 style="color: ${primaryColor}; margin: 0;">${agencyName}</h1>
            </div>
            <h2 style="color: #1f2937;">Welcome Aboard! 🌍</h2>
            <p style="color: #4b5563; line-height: 1.6;">Dear ${clientName},</p>
            <p style="color: #4b5563; line-height: 1.6;">Thank you for choosing ${agencyName} for your upcoming adventure. We're thrilled to help you create unforgettable travel memories.</p>
            <p style="color: #4b5563; line-height: 1.6;">Your dedicated travel consultant is ready to craft the perfect itinerary for you.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${clientPortalUrl}" style="background-color: ${primaryColor}; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; display: inline-block;">Access Your Portal</a>
            </div>
            ${footerHtml}
          </div>
        `;
        break;

      case "booking_confirmation":
        emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              ${logoHtml}
              <h1 style="color: ${primaryColor}; margin: 0;">${agencyName}</h1>
            </div>
            <h2 style="color: #1f2937;">Booking Confirmed! ✈️</h2>
            <p style="color: #4b5563; line-height: 1.6;">Dear ${clientName},</p>
            <p style="color: #4b5563; line-height: 1.6;">Great news! Your booking has been confirmed. Here are your trip details:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 8px 0; color: #374151;"><strong>Destination:</strong> ${templateData?.destination || "TBD"}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Dates:</strong> ${templateData?.dates || "TBD"}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Booking Reference:</strong> ${templateData?.reference || "TBD"}</p>
            </div>
            <p style="color: #4b5563; line-height: 1.6;">We'll send you your detailed itinerary soon.</p>
            ${footerHtml}
          </div>
        `;
        break;

      case "itinerary":
        emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              ${logoHtml}
              <h1 style="color: ${primaryColor}; margin: 0;">${agencyName}</h1>
            </div>
            <h2 style="color: #1f2937;">Your Travel Itinerary 📋</h2>
            <p style="color: #4b5563; line-height: 1.6;">Dear ${clientName},</p>
            <p style="color: #4b5563; line-height: 1.6;">Please find your detailed travel itinerary attached. Here's a quick overview:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 8px 0; color: #374151;"><strong>Trip:</strong> ${templateData?.tripName || "Your Adventure"}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Duration:</strong> ${templateData?.duration || "TBD"}</p>
            </div>
            <p style="color: #4b5563; line-height: 1.6;">Have questions? Don't hesitate to reach out!</p>
            ${footerHtml}
          </div>
        `;
        break;

      case "quote":
        emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              ${logoHtml}
              <h1 style="color: ${primaryColor}; margin: 0;">${agencyName}</h1>
            </div>
            <h2 style="color: #1f2937;">Your Travel Quote 💼</h2>
            <p style="color: #4b5563; line-height: 1.6;">Dear ${clientName},</p>
            <p style="color: #4b5563; line-height: 1.6;">Thank you for your interest! Here's a personalized quote for your trip:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 8px 0; color: #374151;"><strong>Destination:</strong> ${templateData?.destination || "TBD"}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Estimated Cost:</strong> ${templateData?.amount || "TBD"}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Valid Until:</strong> ${templateData?.validUntil || "14 days"}</p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${website || '#'}" style="background-color: ${accentColor}; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; display: inline-block;">Accept Quote</a>
            </div>
            ${footerHtml}
          </div>
        `;
        break;

      case "trip_completed":
        emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              ${logoHtml}
              <h1 style="color: ${primaryColor}; margin: 0;">${agencyName}</h1>
            </div>
            <h2 style="color: #1f2937;">Welcome Back! 🎉</h2>
            <p style="color: #4b5563; line-height: 1.6;">Dear ${clientName},</p>
            <p style="color: #4b5563; line-height: 1.6;">We hope you had an amazing trip to <strong>${templateData?.destination || "your destination"}</strong>!</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 8px 0; color: #374151;"><strong>Trip:</strong> ${templateData?.tripName || templateData?.destination || "Your Adventure"}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Travel Dates:</strong> ${templateData?.dates || "TBD"}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Reference:</strong> ${templateData?.reference || "TBD"}</p>
            </div>
            <p style="color: #4b5563; line-height: 1.6;">We'd love to hear about your experience! Your feedback helps us create even better journeys for you and other travelers.</p>
            <p style="color: #4b5563; line-height: 1.6;">Thank you for traveling with ${agencyName}. We can't wait to help plan your next adventure!</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${website || '#'}" style="background-color: ${primaryColor}; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; display: inline-block;">Plan Your Next Trip</a>
            </div>
            ${footerHtml}
          </div>
        `;
        break;

      case "agent_invitation":
        const inviteUrl = templateData?.inviteUrl || "#";
        const inviterName = templateData?.inviterName || "An administrator";
        const expiresIn = templateData?.expiresIn || "7 days";
        emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              ${logoHtml}
              <h1 style="color: ${primaryColor}; margin: 0;">${agencyName}</h1>
            </div>
            <h2 style="color: #1f2937;">You're Invited! 🎉</h2>
            <p style="color: #4b5563; line-height: 1.6;">Hello,</p>
            <p style="color: #4b5563; line-height: 1.6;">${inviterName} has invited you to join <strong>${agencyName}</strong> as a travel agent.</p>
            <p style="color: #4b5563; line-height: 1.6;">Click the button below to accept your invitation and set up your account:</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteUrl}" style="background-color: ${primaryColor}; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Accept Invitation</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">This invitation will expire in ${expiresIn}. If you didn't expect this invitation, you can safely ignore this email.</p>
            ${footerHtml}
          </div>
        `;
        break;

      case "commission_override_approval":
        const agentNameOverride = templateData?.agentName || "An agent";
        const bookingRef = templateData?.bookingReference || "N/A";
        const clientNameOverride = templateData?.clientName || "Unknown Client";
        const destinationOverride = templateData?.destination || "N/A";
        const calculatedCommission = templateData?.calculatedCommission || "$0.00";
        const overrideAmount = templateData?.overrideAmount || "$0.00";
        const overrideReason = templateData?.overrideReason || "No reason provided";
        const approvalUrl = templateData?.approvalUrl || "#";
        emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              ${logoHtml}
              <h1 style="color: ${primaryColor}; margin: 0;">${agencyName}</h1>
            </div>
            <h2 style="color: #1f2937;">⚠️ Commission Override Requires Approval</h2>
            <p style="color: #4b5563; line-height: 1.6;">A commission override has been submitted that requires your approval:</p>
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 8px 0; color: #374151;"><strong>Agent:</strong> ${agentNameOverride}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Booking:</strong> ${bookingRef}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Client:</strong> ${clientNameOverride}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Destination:</strong> ${destinationOverride}</p>
              <div style="margin: 16px 0; padding-top: 12px; border-top: 1px solid #f59e0b;">
                <p style="margin: 8px 0; color: #374151;"><strong>Calculated Commission:</strong> <span style="text-decoration: line-through;">${calculatedCommission}</span></p>
                <p style="margin: 8px 0; color: #b45309; font-size: 18px;"><strong>Requested Override:</strong> ${overrideAmount}</p>
              </div>
              <p style="margin: 12px 0 0 0; color: #374151;"><strong>Reason:</strong> <em>"${overrideReason}"</em></p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${approvalUrl}" style="background-color: ${primaryColor}; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Review & Approve</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">Log in to the dashboard to approve or reject this commission override request.</p>
            ${footerHtml}
          </div>
        `;

        break;

      case "invoice":
        const invoiceTripName = templateData?.tripName || "Your Trip";
        const invoiceDestination = templateData?.destination || "";
        const invoiceDates = templateData?.dates || "";
        const invoiceTotal = templateData?.tripTotal || "$0.00";
        const invoicePaid = templateData?.totalPaid || "$0.00";
        const invoiceRemaining = templateData?.totalRemaining || "$0.00";
        emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              ${logoHtml}
              <h1 style="color: ${primaryColor}; margin: 0;">${agencyName}</h1>
            </div>
            <h2 style="color: #1f2937;">Your Invoice 📄</h2>
            <p style="color: #4b5563; line-height: 1.6;">Dear ${clientName},</p>
            <p style="color: #4b5563; line-height: 1.6;">Please find your invoice attached for the following trip:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 8px 0; color: #374151;"><strong>Trip:</strong> ${invoiceTripName}</p>
              ${invoiceDestination ? `<p style="margin: 8px 0; color: #374151;"><strong>Destination:</strong> ${invoiceDestination}</p>` : ""}
              ${invoiceDates ? `<p style="margin: 8px 0; color: #374151;"><strong>Travel Dates:</strong> ${invoiceDates}</p>` : ""}
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 8px 0; color: #374151;"><strong>Trip Total:</strong> ${invoiceTotal}</p>
                <p style="margin: 8px 0; color: #22c55e;"><strong>Amount Paid:</strong> ${invoicePaid}</p>
                <p style="margin: 8px 0; color: ${primaryColor}; font-size: 18px;"><strong>Balance Due:</strong> ${invoiceRemaining}</p>
              </div>
            </div>
            <p style="color: #4b5563; line-height: 1.6;">If you have any questions about this invoice, please don't hesitate to reach out.</p>
            ${footerHtml}
          </div>
        `;
        break;

      case "custom":
        // Custom freeform email with user-provided content
        const messageContent = customHtml || "";
        // Convert newlines to <br> tags for proper rendering
        const formattedMessage = messageContent.replace(/\n/g, "<br>");
        emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              ${logoHtml}
              <h1 style="color: ${primaryColor}; margin: 0;">${agencyName}</h1>
            </div>
            <div style="color: #4b5563; line-height: 1.8;">
              ${formattedMessage}
            </div>
            ${footerHtml}
          </div>
        `;
        break;

      default:
        throw new Error("Invalid template type");
    }

    console.log(`Sending ${template} email to ${to}`);

    // Build email options
    const emailOptions: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      attachments?: Array<{ filename: string; content: Buffer }>;
    } = {
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html: emailHtml,
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      emailOptions.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: Buffer.from(att.content, "base64"),
      }));
      console.log(`Adding ${attachments.length} attachment(s) to email`);
    }

    const { data: emailData, error: emailError } = await resend.emails.send(emailOptions);

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    console.log("Email sent successfully:", emailData);

    // Log the email if clientId is provided
    if (clientId) {
      const { error: logError } = await supabase
        .from("email_logs")
        .insert({
          user_id: userId,
          client_id: clientId,
          to_email: to,
          subject,
          template,
          status: "sent",
        });

      if (logError) {
        console.error("Error logging email:", logError);
        // Don't fail the request if logging fails
      } else {
        console.log("Email logged successfully for client:", clientId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, id: emailData?.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-email function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
