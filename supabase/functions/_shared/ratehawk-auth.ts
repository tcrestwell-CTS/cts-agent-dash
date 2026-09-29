// RateHawk / ETG (Emerging Travel Group) API auth + environment helpers.
// Auth is HTTP Basic: base64(RATEHAWK_KEY_ID:RATEHAWK_KEY).
// Environment mirrors HOTELBEDS_ENV: RATEHAWK_ENV = "sandbox" (default) | "production".

export const RATEHAWK_ENV: "sandbox" | "production" =
  (Deno.env.get("RATEHAWK_ENV") || "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";

// NOTE: RateHawk's current hosts are api-sandbox.ratehawk.com (sandbox) and
// api.ratehawk.com (test/production). The older api.worldota.net /
// api-sandbox.worldota.net hosts are DEPRECATED per RateHawk's Authorization
// docs. Environment is selected via RATEHAWK_ENV.
export const RATEHAWK_BASE_URL =
  RATEHAWK_ENV === "production"
    ? "https://api.ratehawk.com"
    : "https://api-sandbox.ratehawk.com";

// Static-IP proxy (VPS). When RATEHAWK_PROXY_SECRET is set, all calls go through
// the proxy, which injects the Basic auth itself — credentials are NOT sent.
// Unset RATEHAWK_PROXY_SECRET to instantly roll back to direct calls.
const PROXY_URL = (Deno.env.get("RATEHAWK_PROXY_URL") || "https://ratehawk-proxy.crestwellgetaways.com").replace(/\/$/, "");
const PROXY_SECRET = Deno.env.get("RATEHAWK_PROXY_SECRET") ?? "";
export const RATEHAWK_VIA_PROXY = PROXY_SECRET.length > 0;

export function ratehawkConfigured(): boolean {
  if (RATEHAWK_VIA_PROXY) return true;
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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  let url: string;
  if (RATEHAWK_VIA_PROXY) {
    url = `${PROXY_URL}${path}`;
    headers["X-Proxy-Secret"] = PROXY_SECRET;
  } else {
    url = `${RATEHAWK_BASE_URL}${path}`;
    headers.Authorization = ratehawkAuthHeader();
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }

  // Never return a non-2xx (or unparseable) response as a value — upstream
  // failures must throw so callers surface RATEHAWK_UPSTREAM_ERROR instead of
  // treating the error as a false-empty success ({ hotels: [] }).
  if (!res.ok) {
    throw new Error(
      `[${res.status}] RateHawk ${path}: ${describeUpstreamError(json, text)}`,
    );
  }
  // Valid RateHawk responses are JSON. A 200 with a non-JSON body is an
  // upstream failure (proxy/gateway page, HTML error, etc.) — never a result.
  if (json === null) {
    throw new Error(`[502] RateHawk ${path}: non-JSON response — ${text.slice(0, 300) || "(empty body)"}`);
  }
  // Envelope errors: ETG can return HTTP 200 with { status: "error", ... }
  // or a bare { error: "incorrect_credentials", ... } without a status field.
  const envelopeError =
    (json.status && json.status !== "ok") ||
    typeof json.error === "string" ||
    (json.error && typeof json.error === "object");
  if (envelopeError) {
    throw new Error(`[502] RateHawk ${path}: ${describeUpstreamError(json, text)}`);
  }
  return json;
}

/** Best-effort human-readable message from a RateHawk error payload. */
function describeUpstreamError(json: any, text: string): string {
  if (json?.error != null) {
    if (typeof json.error === "string") return json.error;
    try { return JSON.stringify(json.error); } catch { /* fall through */ }
  }
  if (typeof json?.message === "string") return json.message;
  return text.slice(0, 300) || "(empty response body)";
}
