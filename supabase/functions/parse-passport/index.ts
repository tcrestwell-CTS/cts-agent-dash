import { createClient } from "npm:@supabase/supabase-js@2";
import { signAwsJsonRequest } from "../_shared/aws-sigv4.ts";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-portal-token",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // Textract sync limit is 10MB

function decodeBase64Size(b64: string): number {
  // Approximate decoded byte length without materializing the buffer twice.
  const clean = b64.replace(/\s/g, "");
  const padding = (clean.match(/=+$/) || [""])[0].length;
  return Math.floor((clean.length * 3) / 4) - padding;
}

/** Textract AnalyzeID field name -> our field name. */
const FIELD_MAP: Record<string, string> = {
  FIRST_NAME: "first_name",
  LAST_NAME: "last_name",
  MIDDLE_NAME: "middle_name",
  DOCUMENT_NUMBER: "passport_number",
  EXPIRATION_DATE: "passport_expiry",
  DATE_OF_BIRTH: "passport_date_of_birth",
  DATE_OF_ISSUE: "passport_issue_date",
  ID_TYPE: "document_type",
  PLACE_OF_BIRTH: "place_of_birth",
  MRZ_CODE: "mrz",
};

/** Textract returns dates as normalized ISO timestamps when it can parse them. */
function toDateOnly(value?: string | null): string | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = getClientIP(req);
  const rl = checkRateLimit(`parse-passport:${ip}`, 12, 60);
  if (rl) return rateLimitResponse(rl.retryAfter, corsHeaders);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const image: string | undefined = body?.image;
    const updateToken: string | undefined = body?.updateToken;

    // ── Authorization: JWT identity, legacy portal token, or profile-link token
    let authorized = false;

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data } = await supabaseUser.auth.getUser();
      if (data?.user) authorized = true;
    }

    if (!authorized) {
      const portalToken = req.headers.get("x-portal-token");
      if (portalToken) {
        const { data: session } = await supabaseAdmin
          .from("client_portal_sessions")
          .select("id")
          .eq("token", portalToken)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (session) authorized = true;
      }
    }

    if (!authorized && updateToken) {
      const { data: tokenRow } = await supabaseAdmin
        .from("client_update_tokens")
        .select("id")
        .eq("token", updateToken)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (tokenRow) authorized = true;
    }

    if (!authorized) return json({ error: "Unauthorized" }, 401);

    if (typeof image !== "string" || image.length < 100) {
      return json({ error: "A passport image is required" }, 400);
    }

    // Strip data URL prefix if present. The image is never persisted.
    const base64 = image.includes(",") ? image.slice(image.indexOf(",") + 1) : image;
    if (decodeBase64Size(base64) > MAX_IMAGE_BYTES) {
      return json({ error: "Image is too large. Please use a photo under 8MB." }, 400);
    }

    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const region = Deno.env.get("AWS_REGION") || "us-east-1";
    if (!accessKeyId || !secretAccessKey) {
      return json({ error: "Passport scanning is not configured" }, 500);
    }

    const signed = await signAwsJsonRequest({
      service: "textract",
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken: Deno.env.get("AWS_SESSION_TOKEN") || undefined,
      target: "Textract.AnalyzeID",
      body: JSON.stringify({ DocumentPages: [{ Bytes: base64 }] }),
    });

    const res = await fetch(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: signed.body,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Textract AnalyzeID failed:", res.status, errText.slice(0, 500));
      return json(
        { error: "Could not read the passport image. Please try a clearer photo." },
        502,
      );
    }

    const result = await res.json();
    const fields: Record<string, string> = {};
    const confidence: Record<string, number> = {};

    for (const doc of result?.IdentityDocuments ?? []) {
      for (const f of doc?.IdentityDocumentFields ?? []) {
        const rawType: string | undefined = f?.Type?.Text;
        const mapped = rawType ? FIELD_MAP[rawType] : undefined;
        const key = mapped ?? (rawType ? rawType.toLowerCase() : undefined);
        if (!key) continue;
        const normalized: string | undefined =
          f?.ValueDetection?.NormalizedValue?.Value || f?.ValueDetection?.Text;
        if (!normalized) continue;
        fields[key] = String(normalized).trim();
        if (typeof f?.ValueDetection?.Confidence === "number") {
          confidence[key] = f.ValueDetection.Confidence;
        }
      }
    }

    const nationality =
      fields["nationality"] || fields["country"] || fields["issuing_country"] || null;
    const fullName = [fields["first_name"], fields["middle_name"], fields["last_name"]]
      .filter(Boolean)
      .join(" ")
      .trim();

    const parsed = {
      first_name: fields["first_name"] || null,
      last_name: fields["last_name"] || null,
      middle_name: fields["middle_name"] || null,
      passport_full_name: fullName || null,
      passport_number: fields["passport_number"] || null,
      passport_nationality: nationality,
      passport_issuing_country:
        fields["issuing_country"] || fields["state_name"] || nationality,
      passport_date_of_birth: toDateOnly(fields["passport_date_of_birth"]),
      passport_expiry: toDateOnly(fields["passport_expiry"]),
      passport_sex: fields["sex"] || fields["gender"] || null,
    };

    const anyFound = Object.values(parsed).some((v) => v !== null);
    if (!anyFound) {
      return json(
        { error: "No passport details were detected. Please try a clearer photo." },
        422,
      );
    }

    // The uploaded image is intentionally not written anywhere — only parsed
    // values are returned, and the request body goes out of scope here.
    return json({ parsed, confidence });
  } catch (err) {
    console.error("parse-passport error:", err instanceof Error ? err.message : err);
    return json({ error: "Internal error" }, 500);
  }
});