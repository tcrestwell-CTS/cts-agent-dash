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
