// Per-advisor QuickBooks attribution: one QBO Class per advisor (tags invoices
// and payouts) and the advisor's QBO Vendor (payee on payout expenses).

const classCache = new Map<string, string | null>();

/** Resolve the advisor (trip owner) user id for a trip. */
export async function getTripAdvisorId(supabase: any, tripId?: string | null): Promise<string | null> {
  if (!tripId) return null;
  const { data } = await supabase.from("trips").select("user_id").eq("id", tripId).maybeSingle();
  return data?.user_id ?? null;
}

/** Display name used for the advisor's QBO Class. */
export async function getAdvisorName(supabase: any, advisorId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, agency_name")
    .eq("user_id", advisorId)
    .maybeSingle();
  const name = (data?.full_name || data?.agency_name || "").trim();
  return name ? name.slice(0, 100) : null;
}

/** Find or create a QBO Class for the advisor. Returns null if classes are unavailable. */
export async function ensureAdvisorClass(
  qboBase: string, headers: any, name: string,
): Promise<string | null> {
  if (classCache.has(name)) return classCache.get(name)!;
  const esc = name.replace(/'/g, "\\'");
  try {
    const q = await fetch(
      `${qboBase}/query?query=${encodeURIComponent(`SELECT * FROM Class WHERE Name = '${esc}'`)}`,
      { headers },
    );
    if (q.ok) {
      const found = (await q.json())?.QueryResponse?.Class?.[0];
      if (found) {
        classCache.set(name, found.Id);
        return found.Id;
      }
    }
    const c = await fetch(`${qboBase}/class`, {
      method: "POST", headers, body: JSON.stringify({ Name: name }),
    });
    if (!c.ok) {
      console.warn(`[qbo-advisor] class create failed for ${name}: ${await c.text()}`);
      classCache.set(name, null);
      return null;
    }
    const id = (await c.json())?.Class?.Id ?? null;
    classCache.set(name, id);
    return id;
  } catch (e) {
    console.warn(`[qbo-advisor] class lookup error: ${e}`);
    return null;
  }
}

/** Convenience: advisor class id for a trip (or null). */
export async function advisorClassForTrip(
  supabase: any, qboBase: string, headers: any, tripId?: string | null,
): Promise<{ advisorId: string | null; classId: string | null }> {
  const advisorId = await getTripAdvisorId(supabase, tripId);
  if (!advisorId) return { advisorId: null, classId: null };
  const name = await getAdvisorName(supabase, advisorId);
  const classId = name ? await ensureAdvisorClass(qboBase, headers, name) : null;
  return { advisorId, classId };
}

/** Apply ClassRef to every line of an Invoice/Purchase payload. */
export function applyClass(payload: any, classId: string | null) {
  if (!classId || !Array.isArray(payload?.Line)) return payload;
  for (const line of payload.Line) {
    const d = line.SalesItemLineDetail ?? line.AccountBasedExpenseLineDetail;
    if (d) d.ClassRef = { value: classId };
  }
  return payload;
}

/** Strip ClassRef from all lines (fallback when QBO class tracking is off). */
export function stripClass(payload: any) {
  for (const line of payload?.Line ?? []) {
    delete line.SalesItemLineDetail?.ClassRef;
    delete line.AccountBasedExpenseLineDetail?.ClassRef;
  }
  return payload;
}

/** Advisor's mapped QBO vendor id, if they've been synced as a vendor. */
export async function getAdvisorVendorId(supabase: any, advisorId?: string | null): Promise<string | null> {
  if (!advisorId) return null;
  const { data } = await supabase
    .from("qbo_agent_vendor_mappings")
    .select("qbo_vendor_id")
    .eq("agent_user_id", advisorId)
    .maybeSingle();
  return data?.qbo_vendor_id ?? null;
}

/** POST to QBO; if rejected because of ClassRef, retry once without it. */
export async function postWithClassFallback(
  doFetch: (url: string, init: RequestInit) => Promise<Response>,
  url: string, headers: any, payload: any,
): Promise<Response> {
  const resp = await doFetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  if (resp.ok) return resp;
  const txt = await resp.text();
  const hasClass = (payload?.Line ?? []).some((l: any) =>
    l.SalesItemLineDetail?.ClassRef || l.AccountBasedExpenseLineDetail?.ClassRef);
  if (hasClass && /class/i.test(txt)) {
    console.warn("[qbo-advisor] ClassRef rejected; retrying without class");
    return doFetch(url, { method: "POST", headers, body: JSON.stringify(stripClass(payload)) });
  }
  return new Response(txt, { status: resp.status, headers: resp.headers });
}
