import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  occupancyKey,
  parseCruiseId,
  parseItemsCell,
  parseMoney,
} from "../_shared/msc-pricing.ts";

/**
 * MSC Flat File 3.0 ingest (Phase 1).
 *
 * MSC's own prescribed architecture: browse/search must run off a local cache
 * built from the flat files (regenerated ~8x/day), and the live API is only
 * used once a specific cruise is selected. The agency-level file contains ONLY
 * Crestwell's dedicated promotions, so market + agency files are both pulled
 * and merged (market rows tagged source='market', agency rows 'agency').
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FF_USER = Deno.env.get("MSC_FLATFILE_USER") ?? "";
const FF_PASSWORD = Deno.env.get("MSC_FLATFILE_PASSWORD") ?? "";
const AGENCY_CODE = Deno.env.get("MSC_FLATFILE_AGENCY_CODE") ?? "";
const CRON_SECRET = Deno.env.get("AUTOMATION_SECRET_KEY") ?? "";

const FF_HOST = "https://www.msconline.com/DownloadArea/ONDEMAND";

type Source = "market" | "agency";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function flatFileUrl(market: string, source: Source, file: string) {
  const mrk = market.toLowerCase();
  return source === "agency"
    ? `${FF_HOST}/${mrk}/${AGENCY_CODE}/flatfile_${mrk}_${file}_csv.zip`
    : `${FF_HOST}/${mrk}/flatfile_${mrk}_${file}_csv.zip`;
}

/** CSV parser tolerant of quoted fields and semicolon or comma delimiters. */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        out.push(cur); cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };

  const headers = splitLine(lines[0]).map((h) => h.replace(/^\uFEFF/, "").toUpperCase());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

function pickField(row: Record<string, string>, ...names: string[]): string {
  for (const n of names) {
    const v = row[n.toUpperCase()];
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

async function downloadCsv(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${btoa(`${FF_USER}:${FF_PASSWORD}`)}` },
  });
  if (!res.ok) throw new Error(`Flat file download failed (${res.status}) for ${url.split("/").pop()}`);

  const buf = new Uint8Array(await res.arrayBuffer());
  // Zips are handled by the unzip helper; MSC also serves plain CSV on some paths.
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  const text = isZip ? await unzipFirstEntry(buf) : new TextDecoder("utf-8").decode(buf);
  return parseCsv(text);
}

/** Extract the first (stored or deflated) entry of a zip archive. */
async function unzipFirstEntry(buf: Uint8Array): Promise<string> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint32(0, true) !== 0x04034b50) throw new Error("Unsupported archive format");
  const method = view.getUint16(8, true);
  const compressedSize = view.getUint32(18, true);
  const nameLen = view.getUint16(26, true);
  const extraLen = view.getUint16(28, true);
  const start = 30 + nameLen + extraLen;
  const body = buf.subarray(start, start + compressedSize);

  if (method === 0) return new TextDecoder("utf-8").decode(body);
  if (method !== 8) throw new Error(`Unsupported zip compression method ${method}`);

  const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

async function upsert(
  db: ReturnType<typeof createClient>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
) {
  let count = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await db.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    count += chunk.length;
  }
  return count;
}

function mapCruises(rows: Record<string, string>[], market: string) {
  const seen = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const cruiseId = pickField(row, "CRUISE-ID", "CRUISEID", "CRUISE_ID");
    if (!cruiseId || seen.has(cruiseId)) continue;
    const parsed = parseCruiseId(cruiseId);
    const nights = Number(pickField(row, "NIGHTS", "NO-OF-NIGHTS")) || null;
    seen.set(cruiseId, {
      cruise_id: cruiseId,
      ship_code: pickField(row, "SHIP-CD", "SHIPCD") || parsed?.shipCode || null,
      sail_date: pickField(row, "SAIL-DATE", "DEP-DATE") || parsed?.sailDate || null,
      nights,
      embark_port_code: pickField(row, "EMB-PORT", "EMBARK-PORT") || parsed?.embarkPort || null,
      disembark_port_code: pickField(row, "DEB-PORT", "DISEMBARK-PORT") || parsed?.disembarkPort || null,
      market_code: market,
      itinerary_name: pickField(row, "ITIN-NAME", "ITINERARY-NAME") || null,
      area_code: pickField(row, "AREA-CD") || null,
      region_code: pickField(row, "REGION-CD") || null,
    });
  }
  return [...seen.values()];
}

function mapFares(rows: Record<string, string>[], market: string, source: Source) {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const cruiseId = pickField(row, "CRUISE-ID", "CRUISEID");
    const fareCode = pickField(row, "FARE-CD", "FARECD", "PRICE-CD");
    if (!cruiseId || !fareCode) continue;
    const category = pickField(row, "CAT-CD", "CATEGORY", "CATEGORY-CD") || "";
    // MSC gates "one step" quoting on these two flags.
    const yes = (v: string) => /^(y|yes|true|1)$/i.test(v.trim());
    const cruiseOnly = yes(pickField(row, "CRUISE-ONLY", "CRUISEONLY"));
    const nowAvailable = yes(pickField(row, "NOW-AVL", "NOWAVL", "NOW-AVAILABLE"));

    // The flat file carries one column per occupancy combination (27 combos).
    for (const [adults, children] of [[1, 0], [2, 0], [2, 1], [2, 2], [3, 0], [4, 0]]) {
      const key = occupancyKey(adults, children);
      const raw = row[key];
      if (raw === undefined || raw === "" || raw.toUpperCase() === "N/A") continue;
      out.push({
        cruise_id: cruiseId,
        fare_code: fareCode,
        price_type: pickField(row, "PRICE-TYPE", "PRICETYPE") || null,
        category_code: category,
        occupancy_key: key,
        fare_description: pickField(row, "FARE-DES", "FARE-DESC", "FARE-DESCRIPTION") || null,
        cruise_only: cruiseOnly,
        now_available: nowAvailable,
        cabin_price: parseMoney(raw),
        gft_adult: parseMoney(pickField(row, "GFT-A")),
        gft_child: parseMoney(pickField(row, "GFT-C")),
        gft_infant: parseMoney(pickField(row, "GFT-I")),
        // Service charges arrive pipe-delimited as PROMO|STANDARD.
        service_charge_adult_promo: parseMoney(pickField(row, "SERVICE-CHARGE-A").split("|")[0]),
        service_charge_adult_standard: parseMoney(pickField(row, "SERVICE-CHARGE-A").split("|")[1] ?? ""),
        service_charge_child_promo: parseMoney(pickField(row, "SERVICE-CHARGE-C").split("|")[0]),
        service_charge_child_standard: parseMoney(pickField(row, "SERVICE-CHARGE-C").split("|")[1] ?? ""),
        currency_code: pickField(row, "CURRENCY-CD", "CURRCY-CD") || "USD",
        market_code: market,
        source,
        agency_code: source === "agency" ? AGENCY_CODE : null,
      });
    }
  }
  return out;
}

function mapItems(rows: Record<string, string>[]) {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const cruiseId = pickField(row, "CRUISE-ID", "CRUISEID");
    if (!cruiseId) continue;
    const fareCode = pickField(row, "FARE-CD", "PRICE-CD") || null;
    for (const item of parseItemsCell(pickField(row, "ITEMS"))) {
      out.push({
        cruise_id: cruiseId,
        fare_code: fareCode,
        item_type: item.type,
        item_code: item.code,
        applicability: item.applicability,
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Scheduled job: authorised by the shared automation secret.
  const secret = req.headers.get("x-automation-secret") ?? "";
  if (!CRON_SECRET || secret !== CRON_SECRET) return json({ error: "Unauthorized" }, 401);

  if (!FF_USER || !FF_PASSWORD) {
    return json(
      {
        error: "MSC flat-file credentials are not configured",
        missing: [!FF_USER && "MSC_FLATFILE_USER", !FF_PASSWORD && "MSC_FLATFILE_PASSWORD"].filter(Boolean),
      },
      503,
    );
  }

  const body = await req.json().catch(() => ({}));
  const market: string = (body?.market ?? "usa").toString();
  const sources: Source[] = AGENCY_CODE ? ["market", "agency"] : ["market"];

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const results: Record<string, unknown>[] = [];

  for (const source of sources) {
    const { data: run } = await db
      .from("msc_flatfile_sync_runs")
      .insert({ market_code: market.toUpperCase(), source, file_name: "prices", status: "running" })
      .select("id")
      .single();

    try {
      const priceRows = await downloadCsv(flatFileUrl(market, source, "prices"));

      // Cruise headers only come from the market file; the agency file is
      // promotions layered on top of the same cruises.
      let cruisesUpserted = 0;
      if (source === "market") {
        cruisesUpserted = await upsert(db, "msc_cruises", mapCruises(priceRows, market.toUpperCase()), "cruise_id");
      }
      const faresUpserted = await upsert(
        db,
        "msc_fares",
        mapFares(priceRows, market.toUpperCase(), source),
        "cruise_id,fare_code,category_code,occupancy_key,source",
      );

      const items = mapItems(priceRows);
      if (items.length) {
        await db.from("msc_items").delete().in("cruise_id", [...new Set(items.map((i) => i.cruise_id as string))]);
        await upsert(db, "msc_items", items, "id");
      }

      await db.from("msc_flatfile_sync_runs").update({
        status: "success",
        rows_processed: priceRows.length,
        rows_upserted: faresUpserted + cruisesUpserted,
        finished_at: new Date().toISOString(),
        details: { cruises: cruisesUpserted, fares: faresUpserted, items: items.length },
      }).eq("id", run?.id);

      results.push({ source, rows: priceRows.length, cruises: cruisesUpserted, fares: faresUpserted, items: items.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("msc-flatfile-sync failed", source, message);
      await db.from("msc_flatfile_sync_runs").update({
        status: "error",
        error_message: message,
        finished_at: new Date().toISOString(),
      }).eq("id", run?.id);
      results.push({ source, error: message });
    }
  }

  return json({ market: market.toUpperCase(), results });
});