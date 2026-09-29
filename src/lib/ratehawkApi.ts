import { supabase } from "@/integrations/supabase/client";

export class RateHawkError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/** Calls the `ratehawk` function and unwraps `{ data }`, surfacing the backend's
 *  own error text (including 400 validation messages) instead of a generic
 *  "non-2xx" error. */
export async function rhInvoke<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T & { _env?: string }> {
  const { data, error } = await supabase.functions.invoke("ratehawk", { body: { action, ...params } });
  if (error) {
    let msg = error.message;
    let code: string | undefined;
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) msg = body.error;
      code = body?.code;
    } catch { /* keep default */ }
    throw new RateHawkError(cleanMsg(msg), code);
  }
  if (data?.error) throw new RateHawkError(cleanMsg(data.error), data.code);
  const out = (data?.data ?? {}) as any;
  if (out && typeof out === "object") out._env = data?.env;
  return out;
}

function cleanMsg(m: string) {
  return String(m || "Unknown error").replace(/^\[\d{3}\]\s*/, "");
}

/** ETG rule mirrored from the backend: unicode letters, spaces and - , . ’ only. */
export const GUEST_NAME_RE = /^[\p{L}\p{M} \-,.\u2019]+$/u;
export function guestNameError(v: string): string | null {
  const t = v.trim();
  if (!t) return "Required";
  if (!GUEST_NAME_RE.test(t)) return "Letters, spaces and - , . ’ only";
  return null;
}

export type RoomGuests = { adults: number; children: number[] };

export const ORDER_STATUS_LABEL: Record<string, string> = {
  prebooked: "Rate held",
  price_change_pending: "Price changed",
  form_created: "Awaiting guest details",
  finishing: "Submitting",
  processing: "Processing",
  booked: "Booked",
  needs_attention: "Needs attention",
  rebook_required: "Rebook required",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "booked") return "default";
  if (["needs_attention", "failed", "rebook_required"].includes(s)) return "destructive";
  if (s === "cancelled") return "outline";
  return "secondary";
}

export const RESIDENCY_OPTIONS: { code: string; name: string }[] = [
  { code: "us", name: "United States" }, { code: "ca", name: "Canada" }, { code: "gb", name: "United Kingdom" },
  { code: "mx", name: "Mexico" }, { code: "de", name: "Germany" }, { code: "fr", name: "France" },
  { code: "it", name: "Italy" }, { code: "es", name: "Spain" }, { code: "au", name: "Australia" },
  { code: "jm", name: "Jamaica" }, { code: "bs", name: "Bahamas" }, { code: "br", name: "Brazil" },
  { code: "in", name: "India" }, { code: "cn", name: "China" }, { code: "jp", name: "Japan" },
  { code: "ng", name: "Nigeria" }, { code: "za", name: "South Africa" }, { code: "mc", name: "Monaco" },
  { code: "uz", name: "Uzbekistan" }, { code: "ae", name: "United Arab Emirates" },
];

export function money(n: number | string | null | undefined, cur = "USD") {
  const v = Number(n);
  if (n == null || !Number.isFinite(v)) return "—";
  return `${cur} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
