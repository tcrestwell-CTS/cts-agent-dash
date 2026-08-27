import { createClient } from "npm:@supabase/supabase-js@2";
import suppliers from "./suppliers.json" with { type: "json" };

const OWNER_ID = "5c2d70a4-a902-47fa-aaf0-f29fc2eb1562";

type Row = {
  name: string;
  supplier_type: string;
  commission_rate: number;
  website: string;
  contact_phone: string;
  notes: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  const secret = req.headers.get("x-agent-secret");
  if (secret !== Deno.env.get("CW_AGENT_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: existing, error: exErr } = await admin
    .from("suppliers")
    .select("id, name")
    .eq("user_id", OWNER_ID);
  if (exErr) return new Response(JSON.stringify({ error: exErr.message }), { status: 500 });

  const byName = new Map<string, string>();
  for (const s of existing ?? []) byName.set(s.name.trim().toLowerCase(), s.id);

  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const r of suppliers as Row[]) {
    const key = r.name.trim().toLowerCase();
    const id = byName.get(key);
    if (id) {
      const { error } = await admin
        .from("suppliers")
        .update({
          commission_rate: r.commission_rate,
          supplier_type: r.supplier_type,
          website: r.website || null,
          contact_phone: r.contact_phone || null,
          notes: r.notes,
        })
        .eq("id", id);
      if (error) errors.push(`${r.name}: ${error.message}`);
      else updated++;
    } else {
      const { error } = await admin.from("suppliers").insert({
        user_id: OWNER_ID,
        name: r.name,
        supplier_type: r.supplier_type,
        commissionable_percentage: 100,
        commission_rate: r.commission_rate,
        website: r.website || null,
        contact_phone: r.contact_phone || null,
        notes: r.notes,
        is_active: true,
      });
      if (error) errors.push(`${r.name}: ${error.message}`);
      else inserted++;
    }
  }

  return new Response(
    JSON.stringify({ total: (suppliers as Row[]).length, inserted, updated, errors }),
    { headers: { "Content-Type": "application/json" } },
  );
});
