// RateHawk / ETG (Emerging Travel Group) API auth + environment helpers.
// Auth is HTTP Basic: base64(RATEHAWK_KEY_ID:RATEHAWK_KEY).
// Environment mirrors HOTELBEDS_ENV: RATEHAWK_ENV = "sandbox" (default) | "production".

export const RATEHAWK_ENV: "sandbox" | "production" =
  (Deno.env.get("RATEHAWK_ENV") || "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";

// NOTE: RateHawk/ETG uses a SINGLE host (https://api.worldota.net) for all
// environments — sandbox vs production is determined by which API key pair
// (RATEHAWK_KEY_ID / RATEHAWK_KEY) you use, NOT by the hostname. Do NOT branch
// the URL on RATEHAWK_ENV; hosts like "api-sandbox.ratehawk.com" do not exist.
export const RATEHAWK_BASE_URL = "https://api.worldota.net";

export function ratehawkConfigured(): boolean {
  return !!Deno.env.get("RATEHAWK_KEY_ID") && !!Deno.env.get("RATEHAWK_KEY");
}

export function ratehawkAuthHeader(): string {
  const keyId = Deno.env.get("RATEHAWK_KEY_ID") ?? "";
  const key = Deno.env.get("RATEHAWK_KEY") ?? "";
  if (!keyId || !key) {
    throw new Error("[500] RateHawk credentials not configured (RATEHAWK_KEY_ID / RATEHAWK_KEY)");
  }
  return `Basic ${btoa(`${keyId}:${key}`)}`;
}

/** POST to a RateHawk endpoint. Throws `[status] message` on HTTP or envelope errors. */
export async function ratehawkPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${RATEHAWK_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: ratehawkAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  if (!res.ok) {
    throw new Error(`[${res.status}] RateHawk ${path}: ${json?.error || text.slice(0, 300)}`);
  }
  if (json?.status && json.status !== "ok") {
    throw new Error(`[502] RateHawk ${path}: ${json.error || "status=error"}`);
  }
  return json;
}
