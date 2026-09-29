/**
 * RateHawk / ETG static-IP proxy (runs on the Lightsail VPS behind Caddy).
 * Flow: Edge Function -> Caddy (TLS) -> this server (127.0.0.1:8787) -> RateHawk
 *
 * - Requires X-Proxy-Secret matching PROXY_SECRET (401 otherwise).
 * - Only allow-listed RateHawk paths are forwarded (404 otherwise) — never an open relay.
 * - Injects Basic auth from RATEHAWK_KEY_ID / RATEHAWK_KEY (VPS-only env).
 * - Upstream status and body are returned unchanged.
 */
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";

const PORT = parseInt(process.env.PORT || "8787", 10);
const HOST = process.env.HOST || "127.0.0.1";
const PROXY_SECRET = process.env.PROXY_SECRET || "";
const KEY_ID = process.env.RATEHAWK_KEY_ID || "";
const KEY = process.env.RATEHAWK_KEY || "";
const ENV = (process.env.RATEHAWK_ENV || "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
const UPSTREAM = ENV === "production" ? "https://api.ratehawk.com" : "https://api-sandbox.ratehawk.com";
const MAX_BODY = 1024 * 1024; // 1 MB

if (PROXY_SECRET.length < 32 || !KEY_ID || !KEY) {
  console.error("Missing PROXY_SECRET (>=32 chars), RATEHAWK_KEY_ID or RATEHAWK_KEY");
  process.exit(1);
}

// Exact paths (trailing slash optional). Keep in sync with supabase/functions.
const ALLOWED_PATHS = new Set([
  // Search (SERP) — used today
  "/api/b2b/v3/search/serp/region",
  "/api/b2b/v3/search/serp/hotels",
  "/api/b2b/v3/search/serp/geo",
  // Content — used today by ratehawk-content-sync
  "/api/content/v1/hotel_content_by_ids",
  // Booking flow — for the upcoming booking phase
  "/api/b2b/v3/search/hp",
  "/api/b2b/v3/hotel/prebook",
  "/api/b2b/v3/hotel/order/booking/form",
  "/api/b2b/v3/hotel/order/booking/finish",
  "/api/b2b/v3/hotel/order/booking/finish/status",
  "/api/b2b/v3/hotel/order/cancel",
  "/api/b2b/v3/hotel/order/info",
]);

const STRIP = new Set([
  "host", "connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "te", "trailer",
  "content-length", "authorization", "proxy-authorization", "x-proxy-secret", "cookie",
  "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip", "via", "forwarded",
]);

const authHeader = `Basic ${Buffer.from(`${KEY_ID}:${KEY}`).toString("base64")}`;
const secretBuf = Buffer.from(PROXY_SECRET);

function send(res: ServerResponse, status: number, obj: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function secretOk(v: string | string[] | undefined): boolean {
  if (typeof v !== "string") return false;
  const b = Buffer.from(v);
  return b.length === secretBuf.length && timingSafeEqual(b, secretBuf);
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/healthz") return send(res, 200, { ok: true, env: ENV });

  if (!secretOk(req.headers["x-proxy-secret"])) return send(res, 401, { error: "Unauthorized" });

  const path = url.pathname.replace(/\/+$/, "");
  if (!ALLOWED_PATHS.has(path) || req.method !== "POST") return send(res, 404, { error: "Not found" });

  try {
    const body = await readBody(req);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!STRIP.has(k.toLowerCase()) && typeof v === "string") headers[k] = v;
    }
    headers["authorization"] = authHeader;
    headers["content-type"] ||= "application/json";

    const upstream = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(60_000),
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "x-proxied-by": "ratehawk-proxy",
      "x-proxy-env": ENV,
    });
    res.end(text);
    console.log(`${req.method} ${path} -> ${upstream.status} ${Date.now() - started}ms`);
  } catch (err: any) {
    console.error(`proxy error ${path}:`, err?.message);
    send(res, 502, { error: `Proxy error: ${err?.message || "unknown"}` });
  }
}).listen(PORT, HOST, () => console.log(`ratehawk-proxy (${ENV}) on ${HOST}:${PORT}`));
