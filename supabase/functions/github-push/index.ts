// github-push
// Internal maintenance helper: commits a file to a connected GitHub repository
// through the Lovable connector gateway. Authenticated with the project's own
// LOVABLE_API_KEY, so it is not usable by app users or the public.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const responseHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: responseHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GITHUB_API_KEY = Deno.env.get("GITHUB_API_KEY");
  if (!LOVABLE_API_KEY || !GITHUB_API_KEY) {
    return new Response(JSON.stringify({ error: "GitHub connection is not configured" }), {
      status: 500,
      headers: responseHeaders,
    });
  }

  const provided = req.headers.get("x-internal-key") || "";
  if (provided !== LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: responseHeaders });
  }

  try {
    const { owner, repo, path, content, message, branch } = await req.json();
    if (!owner || !repo || !path || typeof content !== "string" || !message) {
      return new Response(JSON.stringify({ error: "owner, repo, path, content and message are required" }), {
        status: 400,
        headers: responseHeaders,
      });
    }

    const gh = (endpoint: string, init: RequestInit = {}) =>
      fetch(`${GATEWAY_URL}${endpoint}`, {
        ...init,
        headers: {
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GITHUB_API_KEY,
          ...(init.headers || {}),
        },
      });

    const ref = branch || "main";

    // Current file SHA (absent for a brand-new file)
    let sha: string | undefined;
    const head = await gh(`/repos/${owner}/${repo}/contents/${path}?ref=${ref}`);
    if (head.ok) {
      const existing = await head.json();
      sha = existing.sha;
    } else if (head.status !== 404) {
      const body = await head.text();
      return new Response(JSON.stringify({ error: "GitHub lookup failed", status: head.status, details: body }), {
        status: head.status,
        headers: responseHeaders,
      });
    }

    const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(content)));

    const put = await gh(`/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({ message, content: encoded, branch: ref, ...(sha ? { sha } : {}) }),
    });

    const bodyText = await put.text();
    if (!put.ok) {
      console.error(`[github-push] commit failed [${put.status}]: ${bodyText}`);
      return new Response(JSON.stringify({ error: "GitHub commit failed", status: put.status, details: bodyText }), {
        status: put.status,
        headers: responseHeaders,
      });
    }

    const result = JSON.parse(bodyText);
    return new Response(
      JSON.stringify({ success: true, path, commit: result.commit?.sha, html_url: result.content?.html_url }),
      { status: 200, headers: responseHeaders },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[github-push] Error:", msg);
    return new Response(JSON.stringify({ error: "Internal server error", detail: msg }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
