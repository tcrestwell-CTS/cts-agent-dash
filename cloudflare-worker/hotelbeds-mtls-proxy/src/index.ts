/**
 * Cloudflare Worker — Hotelbeds mTLS Proxy (pass-through)
 *
 * The Supabase Edge Function sends the request exactly as Hotelbeds expects it
 * (same method, path, query, body and Api-key/X-Signature headers). This worker
 * only swaps the origin and attaches the registered client certificate.
 *
 * Flow:  Edge Function  →  this Worker (adds mTLS cert)  →  api-mtls[.test].hotelbeds.com
 *
 * IMPORTANT: an mTLS-registered API key MUST use the api-mtls hosts. The plain
 * api.hotelbeds.com host rejects it with 403 "Access to this API has been
 * disallowed", and api.test.hotelbeds.com with 401 "You cannot access a
 * non-mTLS endpoint with an apikey for mTLS".
 *
 * Auth: the caller sends X-MTLS-Proxy-Token, matched against PROXY_AUTH_TOKEN.
 * Target env: the caller sends X-MTLS-Target-Env: "live" | "test" (default live).
 *
 * Setup:
 *   1. wrangler mtls-certificate upload --cert cert.pem --key key.pem --name hotelbeds-mtls
 *   2. Put the returned certificate_id in wrangler.toml
 *   3. wrangler secret put PROXY_AUTH_TOKEN
 *   4. wrangler deploy
 */

export interface Env {
  HOTELBEDS_CERT: Fetcher;        // mTLS certificate binding
  PROXY_AUTH_TOKEN: string;       // Shared secret for Edge Function auth
  HOTELBEDS_LIVE_ORIGIN: string;  // https://api-mtls.hotelbeds.com
  HOTELBEDS_TEST_ORIGIN: string;  // https://api-mtls.test.hotelbeds.com
}

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "x-mtls-proxy-token",
  "x-mtls-target-env",
  "cf-connecting-ip",
  "cf-ray",
  "cf-ipcountry",
  "cf-visitor",
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "content-type, api-key, x-signature, accept, x-mtls-proxy-token, x-mtls-target-env",
        },
      });
    }

    const token = request.headers.get("x-mtls-proxy-token");
    if (!token || token !== env.PROXY_AUTH_TOKEN) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const incoming = new URL(request.url);
      const targetEnv = (request.headers.get("x-mtls-target-env") || "live").toLowerCase();
      const origin =
        targetEnv === "test"
          ? env.HOTELBEDS_TEST_ORIGIN || "https://api-mtls.test.hotelbeds.com"
          : env.HOTELBEDS_LIVE_ORIGIN || "https://api-mtls.hotelbeds.com";

      const targetUrl = `${origin}${incoming.pathname}${incoming.search}`;

      const headers = new Headers();
      for (const [k, v] of request.headers) {
        if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v);
      }
      headers.set("Accept-Encoding", "gzip");

      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.text(),
        // @ts-ignore — Cloudflare-specific mTLS binding
        cf: { clientCertificate: env.HOTELBEDS_CERT },
      });

      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "application/json",
          "Access-Control-Allow-Origin": "*",
          "x-proxied-by": "cts-hotel-mtls-proxy",
          "x-proxy-mtls": "on",
          "x-proxy-target": targetUrl,
        },
      });
    } catch (err: any) {
      console.error("mTLS proxy error:", err);
      return Response.json({ error: err?.message || "Proxy error" }, { status: 502 });
    }
  },
};
