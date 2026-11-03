import { describe, it, expect } from "vitest";
import { refreshQboConnection } from "../../supabase/functions/_shared/qbo-token";

const old = { id: "connection", is_active: true, refresh_token: "old", access_token: "old-access", token_expires_at: "2026-01-01T00:00:00Z" };
function database(latest: object) {
  const updates: object[] = [];
  const chain: any = {
    select: () => chain, eq: () => chain,
    update: (value: object) => { updates.push(value); return chain; },
    maybeSingle: async () => ({ data: latest, error: null }),
    then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
  };
  return { db: { from: () => chain }, updates };
}
describe("QuickBooks renewal races", () => {
  it("adopts a concurrent successful renewal instead of deactivating it", async () => {
    const renewed = { ...old, access_token: "new", token_expires_at: new Date(Date.now() + 3_600_000).toISOString() };
    const { db, updates } = database(renewed);
    const result = await refreshQboConnection(db, old, "id", "secret", async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    expect(result).toEqual(renewed);
    expect(updates).toHaveLength(0);
  });
  it("keeps the connection active on temporary upstream failure", async () => {
    const { db, updates } = database(old);
    await expect(refreshQboConnection(db, old, "id", "secret", async () => new Response("unavailable", { status: 503 }))).rejects.toThrow("temporarily unavailable");
    expect(updates).toHaveLength(0);
  });
  it("requires reconnection for a confirmed invalid refresh token", async () => {
    const { db, updates } = database(old);
    await expect(refreshQboConnection(db, old, "id", "secret", async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }))).rejects.toThrow("reconnect");
    expect(updates).toEqual([{ is_active: false }]);
  });
});