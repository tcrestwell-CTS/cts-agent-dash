// Simple in-memory rate limiter for Edge Functions
// Resets on cold start, but effective against burst abuse

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean old entries periodically
let lastClean = Date.now();
function cleanStore() {
  const now = Date.now();
  if (now - lastClean < 60_000) return; // clean every 60s
  lastClean = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Check rate limit for a given key (usually IP or IP+email).
 * @returns null if allowed, or { retryAfter: seconds } if blocked
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowSeconds: number = 60
): { retryAfter: number } | null {
  cleanStore();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return null;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { retryAfter };
  }

  return null;
}

/**
 * Get client IP from request headers (Cloudflare/Supabase proxy headers)
 */
export function getClientIP(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Build a 429 response with proper headers
 */
export function rateLimitResponse(retryAfter: number, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
