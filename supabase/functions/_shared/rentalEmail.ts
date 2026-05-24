export const RENTAL_AGENT_PHONE = "888.508.6893";
export const RENTAL_FROM = "Crestwell Travel <noreply@crestwellgetaways.com>";
export const RENTAL_PUBLIC_BASE = "https://crestwellgetaways.com";

export function fmtDateTime(d?: string | null, t?: string | null): string {
  if (!d) return "—";
  return t ? `${d} ${t}` : d;
}

export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: RENTAL_FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    return { ok: false, error: `Resend ${r.status}: ${text}` };
  }
  return { ok: true };
}

export function rentalSummaryHtml(rental: Record<string, any>): string {
  return `
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td><strong>Provider:</strong></td><td>${escapeHtml(rental.provider)}</td></tr>
      <tr><td><strong>Vehicle:</strong></td><td>${escapeHtml(rental.vehicle_class)}</td></tr>
      <tr><td><strong>Pickup:</strong></td><td>${escapeHtml(rental.pickup_location)} — ${escapeHtml(fmtDateTime(rental.pickup_date, rental.pickup_time))}</td></tr>
      <tr><td><strong>Drop-off:</strong></td><td>${escapeHtml(rental.dropoff_location || rental.pickup_location)} — ${escapeHtml(fmtDateTime(rental.return_date, rental.return_time))}</td></tr>
    </table>`;
}