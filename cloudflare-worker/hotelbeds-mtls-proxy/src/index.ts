/**
 * Cloudflare Worker — Hotelbeds mTLS Proxy
 *
 * This worker sits between the Supabase Edge Function and Hotelbeds production API.
 * It attaches the client certificate (mTLS) required by Hotelbeds for production access.
 *
 * Flow:  Edge Function  →  this Worker (adds mTLS cert)  →  Hotelbeds API
 *
 * Setup:
 *   1. Upload PEM cert/key:
 *        wrangler mtls-certificate upload --cert cert.pem --key key.pem --name hotelbeds-mtls
 *   2. Copy the returned certificate_id into wrangler.toml
 *   3. Set the shared auth token:
 *        wrangler secret put PROXY_AUTH_TOKEN
 *   4. Deploy:
 *        wrangler deploy
 */

export interface Env {
  HOTELBEDS_CERT: Fetcher;          // mTLS certificate binding
  PROXY_AUTH_TOKEN: string;          // Shared secret for Edge Function auth
  HOTELBEDS_BOOKING_API: string;     // https://api.hotelbeds.com/hotel-api/1.0
  HOTELBEDS_CONTENT_API: string;     // https://api.hotelbeds.com/hotel-content-api/1.0
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "content-type, x-proxy-token",
        },
      });
    }

    // Authenticate the caller (Edge Function)
    const proxyToken = request.headers.get("x-proxy-token");
    if (!proxyToken || proxyToken !== env.PROXY_AUTH_TOKEN) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = await request.json() as {
        targetUrl: string;   // Full Hotelbeds URL path, e.g. "/hotels"
        method: string;      // "GET" | "POST" | "DELETE"
        apiBase: "booking" | "content";
        headers: Record<string, string>;  // Api-key, X-Signature, etc.
        body?: any;
      };

      const baseUrl = body.apiBase === "content"
        ? env.HOTELBEDS_CONTENT_API
        : env.HOTELBEDS_BOOKING_API;

      const targetUrl = `${baseUrl}${body.targetUrl}`;

      const fetchOptions: RequestInit = {
        method: body.method,
        headers: {
          ...body.headers,
          "Accept-Encoding": "gzip",
        },
        // @ts-ignore — Cloudflare-specific mTLS binding
        cf: {
          // Attach the client certificate for mTLS
          clientCertificate: env.HOTELBEDS_CERT,
        },
      };

      if (body.body && body.method !== "GET") {
        fetchOptions.body = JSON.stringify(body.body);
      }

      const response = await fetch(targetUrl, fetchOptions);
      const responseData = await response.text();

      return new Response(responseData, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err: any) {
      console.error("mTLS proxy error:", err);
      return Response.json(
        { error: err.message || "Proxy error" },
        { status: 502 }
      );
    }
  },
};
