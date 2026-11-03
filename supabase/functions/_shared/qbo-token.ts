/** Keep concurrent QBO renewals from disabling a newer, valid connection. */
export async function refreshQboConnection(db: any, connection: any, clientId: string, clientSecret: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: connection.refresh_token }),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    const { data: latest, error } = await db.from("qbo_connections").select("*").eq("id", connection.id).maybeSingle();
    if (error) throw new Error("QuickBooks connection lookup failed. Please retry.");
    if (latest?.is_active && new Date(latest.token_expires_at).getTime() > Date.now() + 60_000 &&
      (latest.token_expires_at !== connection.token_expires_at || latest.access_token !== connection.access_token)) return latest;
    if (response.status === 400 && failure.error === "invalid_grant") {
      await db.from("qbo_connections").update({ is_active: false })
        .eq("id", connection.id).eq("refresh_token", connection.refresh_token)
        .eq("token_expires_at", connection.token_expires_at);
      throw new Error("QuickBooks authorization expired. Please reconnect in Settings.");
    }
    throw new Error("QuickBooks renewal is temporarily unavailable. Please retry.");
  }
  const tokens = await response.json();
  if (!tokens.access_token || !tokens.refresh_token || !(Number(tokens.expires_in) > 0)) {
    throw new Error("QuickBooks returned an invalid renewal response. Please retry.");
  }
  const updated = { access_token: tokens.access_token, refresh_token: tokens.refresh_token,
    token_expires_at: new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString(), is_active: true };
  const { data: saved, error } = await db.from("qbo_connections").update(updated)
    .eq("id", connection.id).eq("refresh_token", connection.refresh_token).select("*").maybeSingle();
  if (error) throw new Error("QuickBooks renewal could not be saved. Please retry.");
  if (saved) return saved;
  const { data: latest } = await db.from("qbo_connections").select("*").eq("id", connection.id).maybeSingle();
  if (latest?.is_active && new Date(latest.token_expires_at).getTime() > Date.now() + 60_000) return latest;
  throw new Error("QuickBooks connection changed during renewal. Please retry.");
}