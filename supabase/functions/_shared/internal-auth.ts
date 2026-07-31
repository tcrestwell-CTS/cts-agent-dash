// Shared authentication helpers for internal / automation edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AGENT_SECRET = Deno.env.get("CW_AGENT_SECRET") ?? "";

function bearer(req: Request): string {
  const h = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

/** True when the caller presents the service-role key or the internal agent secret. */
export function isInternalCaller(req: Request): boolean {
  const token = bearer(req);
  if (SUPA_SVC && token && token === SUPA_SVC) return true;
  const secret = req.headers.get("x-agent-secret") || "";
  if (AGENT_SECRET && secret && secret === AGENT_SECRET) return true;
  return false;
}

/** Resolves the signed-in user from the request JWT, or null. */
export async function getRequestUser(req: Request) {
  const token = bearer(req);
  if (!token || token === SUPA_SVC) return null;
  const db = createClient(SUPA_URL, SUPA_SVC);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
  const db = createClient(SUPA_URL, SUPA_SVC);
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  return (data || []).some((r: any) => roles.includes(r.role));
}

/**
 * Allows internal callers (service role / agent secret) or any authenticated user.
 * Returns null when authorized, otherwise a 401 Response.
 */
export async function requireInternalOrUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ user: any | null } | Response> {
  if (isInternalCaller(req)) return { user: null };
  const user = await getRequestUser(req);
  if (user) return { user };
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Allows internal callers or an authenticated admin / office_admin.
 * Returns null when authorized, otherwise a 401/403 Response.
 */
export async function requireInternalOrAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ user: any | null } | Response> {
  if (isInternalCaller(req)) return { user: null };
  const user = await getRequestUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!(await hasAnyRole(user.id, ["admin", "office_admin"]))) {
    return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { user };
}
