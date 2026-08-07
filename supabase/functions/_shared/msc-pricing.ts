/**
 * MSC Flat File 3.0 price arithmetic.
 *
 * Per the MSC Flat File Pricing Specifications:
 *  - The cabin-price column (e.g. `2A`, `2A2C`) INCLUDES NCF but EXCLUDES
 *    port charges (GFT-*) and service charges.
 *  - Service-charge columns are pipe-delimited `PROMO|STANDARD` and are
 *    charged per person PER NIGHT.
 *  - `N/A` in either pipe position means not applicable (treat as 0).
 *
 *  2 adults        = 2A   + 2*GFT-A + 2*SERVICE-CHARGE-A*NIGHTS
 *  2 adults 2 kids = 2A2C + 2*GFT-A + 2*GFT-C
 *                         + (2*SERVICE-CHARGE-A + 2*SERVICE-CHARGE-C)*NIGHTS
 */

export type ServiceChargeMode = "promo" | "standard";

export interface MscPriceInputs {
  /** Cabin price column for the occupancy combination (includes NCF). */
  cabinPrice: number;
  nights: number;
  adults: number;
  children?: number;
  infants?: number;
  /** Port charges (GFT-*) per person. */
  gftAdult?: number | null;
  gftChild?: number | null;
  gftInfant?: number | null;
  /** Service charges per person per night, `PROMO|STANDARD`. */
  serviceChargeAdult?: string | number | null;
  serviceChargeChild?: string | number | null;
  mode?: ServiceChargeMode;
}

export interface MscPriceBreakdown {
  cabinPrice: number;
  portCharges: number;
  serviceCharges: number;
  total: number;
  mode: ServiceChargeMode;
}

/** `N/A` -> 0, blank -> 0, numeric strings -> number. */
export function parseMoney(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  if (!raw || raw.toUpperCase() === "N/A") return 0;
  const n = Number(raw.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Split a `PROMO|STANDARD` service-charge cell into both values. */
export function parseServiceCharge(
  cell: string | number | null | undefined,
): { promo: number; standard: number } {
  if (cell === null || cell === undefined) return { promo: 0, standard: 0 };
  if (typeof cell === "number") return { promo: cell, standard: cell };
  const [promo, standard] = String(cell).split("|");
  return {
    promo: parseMoney(promo),
    standard: parseMoney(standard === undefined ? promo : standard),
  };
}

function pick(
  cell: string | number | null | undefined,
  mode: ServiceChargeMode,
): number {
  const { promo, standard } = parseServiceCharge(cell);
  return mode === "promo" ? promo : standard;
}

/**
 * Total payable for an occupancy combination. Always display this — never the
 * bare cabin-price column, or quotes will not match MSC's own site.
 */
export function computeMscTotal(input: MscPriceInputs): MscPriceBreakdown {
  const mode = input.mode ?? "promo";
  const adults = Math.max(0, input.adults);
  const children = Math.max(0, input.children ?? 0);
  const infants = Math.max(0, input.infants ?? 0);
  const nights = Math.max(0, input.nights);

  const cabinPrice = parseMoney(input.cabinPrice);

  const portCharges =
    adults * parseMoney(input.gftAdult) +
    children * parseMoney(input.gftChild) +
    infants * parseMoney(input.gftInfant);

  const scAdult = pick(input.serviceChargeAdult, mode);
  const scChild = pick(input.serviceChargeChild, mode);
  const serviceCharges = (adults * scAdult + children * scChild) * nights;

  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    cabinPrice: round(cabinPrice),
    portCharges: round(portCharges),
    serviceCharges: round(serviceCharges),
    total: round(cabinPrice + portCharges + serviceCharges),
    mode,
  };
}

/** `ITEMS` cell: `OBS:DOLCE:S|TRF:TRF0102:O` */
export interface MscFlatItem {
  type: string;
  code: string;
  /** M = mandatory, O = optional, S = substitutable */
  applicability: string | null;
}

export function parseItemsCell(cell: string | null | undefined): MscFlatItem[] {
  if (!cell) return [];
  return String(cell)
    .split("|")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk && chunk.toUpperCase() !== "N/A")
    .map((chunk) => {
      const [type, code, applicability] = chunk.split(":");
      return {
        type: (type ?? "").trim(),
        code: (code ?? "").trim(),
        applicability: applicability ? applicability.trim() : null,
      };
    })
    .filter((i) => i.type && i.code);
}

/** `EU20260404MRSMRS` -> ship EU, 2026-04-04, Marseille -> Marseille. */
export function parseCruiseId(cruiseId: string): {
  shipCode: string;
  sailDate: string | null;
  embarkPort: string;
  disembarkPort: string;
} | null {
  const m = /^([A-Z0-9]{2})(\d{8})([A-Z]{3})([A-Z]{3})$/.exec(cruiseId.trim());
  if (!m) return null;
  const [, shipCode, ymd, embarkPort, disembarkPort] = m;
  const sailDate = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  return { shipCode, sailDate, embarkPort, disembarkPort };
}

/** Occupancy key used by the flat file, e.g. 2 adults + 2 children -> `2A2C`. */
export function occupancyKey(adults: number, children = 0, infants = 0): string {
  let key = `${adults}A`;
  if (children > 0) key += `${children}C`;
  if (infants > 0) key += `${infants}I`;
  return key;
}
