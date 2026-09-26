// RateHawk / ETG static content sync → public.ratehawk_hotels.
// Triggered by pg_cron (x-automation-secret) or a signed-in admin.
//
// Phase 1: driven by an explicit hotel-ID list (body `ids`, default = ETG sandbox
// certification test hotels). Region-based discovery via
// /api/content/v1/filter_values and /api/content/v1/hotel_ids_by_filter is
// DEFERRED — the OpenAPI spec doesn't document their query params; confirm with
// ETG's account manager / prose docs before implementing.
import { createClient } from "npm:@supabase/supabase-js@2";
import { ratehawkPost } from "../_shared/ratehawk-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_HIDS = [10004834, 8819557];
const BATCH_SIZE = 100;

function mapHotel(h: any) {
  return {
    id: String(h.id),
    hid: h.hid ?? null,
    name: h.name ?? null,
    address: h.address ?? null,
    region_id: h.region?.id ?? null,
    region_name: h.region?.name ?? null,
    country_code: h.region?.country_code ?? null,
    star_rating: h.star_rating ?? null,
    latitude: h.latitude ?? null,
    longitude: h.longitude ?? null,
    amenity_groups: h.amenity_groups ?? null,
    images_ext: h.images_ext ?? null,
    room_groups: h.room_groups ?? null,
    metapolicy_struct: h.metapolicy_struct ?? null,
    metapolicy_extra_info: h.metapolicy_extra_info ?? null,
    facts: h.facts ?? null,
    check_in_time: h.check_in_time ?? null,
    check_out_time: h.check_out_time ?? null,
    phone: h.phone ?? null,
    email: h.email ?? null,
    raw: h,
    last_synced_at: new Date().toISOString(),
  };
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cronSecret = req.headers.get("x-automation-secret");
  const authHeader = req.headers.get("Authorization");
  let triggeredBy = "cron";

  if (!cronSecret || cronSecret !== Deno.env.get("AUTOMATION_SECRET_KEY")) {
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admin required" }, 403);
    triggeredBy = `admin:${user.id}`;
  }

  const body = await req.json().catch(() => ({}));
  const hids: number[] = Array.isArray(body.hids) && body.hids.length
    ? body.hids.map((i: any) => Number(i)).filter((n: number) => Number.isFinite(n))
    : DEFAULT_HIDS;
  const language = body.language || "en";

  const { data: run } = await supabase
    .from("ratehawk_sync_runs")
    .insert({ status: "running", triggered_by: triggeredBy })
    .select("id")
    .single();

  let processed = 0;
  let upserted = 0;
  let pages = 0;

  try {
    for (let i = 0; i < hids.length; i += BATCH_SIZE) {
      const batch = hids.slice(i, i + BATCH_SIZE);
      const resp = await ratehawkPost("/api/content/v1/hotel_content_by_ids", { hids: batch, language });
      const hotels: any[] = Array.isArray(resp?.data) ? resp.data : [];
      pages += 1;
      if (!hotels.length) continue;
      const rows = hotels.filter((h) => h?.id != null).map(mapHotel);
      const { error: upErr, count } = await supabase
        .from("ratehawk_hotels")
        .upsert(rows, { onConflict: "id", count: "exact" });
      if (upErr) throw upErr;
      processed += hotels.length;
      upserted += count ?? rows.length;
    }

    await supabase.from("ratehawk_sync_runs").update({
      status: "success",
      finished_at: new Date().toISOString(),
      hotels_processed: processed,
      hotels_upserted: upserted,
      pages_fetched: pages,
    }).eq("id", run!.id);

    return json({ ok: true, processed, upserted, pages });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("ratehawk_sync_runs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      hotels_processed: processed,
      hotels_upserted: upserted,
      pages_fetched: pages,
      error: msg,
    }).eq("id", run!.id);
    return json({ error: msg }, 500);
  }
});
