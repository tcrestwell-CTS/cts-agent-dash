import { supabase } from "@/integrations/supabase/client";

/**
 * Lookup helpers backed by the column-limited bookkeeper_* views.
 *
 * Bookkeepers intentionally have no direct read access to the `clients`,
 * `profiles`, or `suppliers` tables (which hold passport data, addresses,
 * phone numbers and commission rates). These views expose only the display
 * name / contact email needed for accounting reports.
 */

function uniq(ids: (string | null | undefined)[]): string[] {
  return Array.from(new Set(ids.filter((v): v is string => !!v)));
}

export interface SupplierLite {
  id: string;
  name: string | null;
  contact_email: string | null;
}

export async function fetchSupplierMap(
  ids: (string | null | undefined)[],
): Promise<Record<string, SupplierLite>> {
  const list = uniq(ids);
  if (!list.length) return {};
  const { data } = await (supabase as any)
    .from("bookkeeper_suppliers_view")
    .select("id, name, contact_email")
    .in("id", list);
  return Object.fromEntries(((data ?? []) as SupplierLite[]).map((s) => [s.id, s]));
}

export interface ClientLite {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export async function fetchClientMap(
  ids: (string | null | undefined)[],
): Promise<Record<string, ClientLite>> {
  const list = uniq(ids);
  if (!list.length) return {};
  const { data } = await (supabase as any)
    .from("bookkeeper_clients_view")
    .select("id, name, first_name, last_name, email")
    .in("id", list);
  return Object.fromEntries(((data ?? []) as ClientLite[]).map((c) => [c.id, c]));
}

export interface ProfileLite {
  user_id: string;
  full_name: string | null;
  commission_tier: string | null;
}

export async function fetchProfileMap(
  userIds: (string | null | undefined)[],
): Promise<Record<string, ProfileLite>> {
  const list = uniq(userIds);
  if (!list.length) return {};
  const { data } = await (supabase as any)
    .from("bookkeeper_profiles_view")
    .select("user_id, full_name, commission_tier")
    .in("user_id", list);
  return Object.fromEntries(((data ?? []) as ProfileLite[]).map((p) => [p.user_id, p]));
}

export async function fetchAllProfilesLite(): Promise<ProfileLite[]> {
  const { data } = await (supabase as any)
    .from("bookkeeper_profiles_view")
    .select("user_id, full_name, commission_tier");
  return (data ?? []) as ProfileLite[];
}
