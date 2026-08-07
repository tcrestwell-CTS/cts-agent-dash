/**
 * Parser for MSC `DtsSearchCruisesResponseV1` (Search Cruise CruiseOnly).
 *
 * The gateway returns a very large POX document. This flattens it into the
 * shape the dashboard needs: one entry per priced category/fare, with the
 * port-charge (GFT-*) and service-charge components kept separate so the
 * displayed total is always computed, never the bare cabin price.
 */

import { readTags, readTag } from "./msc-xml.ts";

const num = (v: string | null): number | null => {
  if (v === null) return null;
  const raw = v.trim();
  if (!raw || raw.toUpperCase() === "N/A") return null;
  const n = Number(raw.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export interface MscServiceChargeItem {
  type: string | null;
  code: string | null;
  adult: number | null;
  child: number | null;
  junior: number | null;
  senior: number | null;
  infant: number | null;
  total: number | null;
  standard: boolean;
}

export interface MscSearchCruise {
  cruiseId: string | null;
  shipCd: string | null;
  shipName: string | null;
  departureDate: string | null;
  arrivalDate: string | null;
  cruiseLen: number | null;
  embarkPort: string | null;
  embarkPortDesc: string | null;
  disembarkPort: string | null;
  disembarkPortDesc: string | null;
  category: string | null;
  macroCategory: string | null;
  pricedCategory: string | null;
  pricedOccupancy: number | null;
  maximumOccupancy: number | null;
  priceCode: string | null;
  priceType: string | null;
  priceDesc: string | null;
  currency: string | null;
  /** Includes NCF, excludes port + service charges. */
  cabinPrice: number | null;
  totalCabinPrice: number | null;
  firstPaxPrice: number | null;
  secondPaxPrice: number | null;
  singlePrice: number | null;
  portChargesAmt: number | null;
  /** Per-person port charges (GFT). */
  gftAdult: number | null;
  gftChild: number | null;
  gftSingle: number | null;
  ncfAdult: number | null;
  cabinsAvailable: number | null;
  guaranteesAvailable: number | null;
  totalAvailable: number | null;
  instantConfirm: string | null;
  airMandatory: boolean;
  commissionAmt: number | null;
  serviceCharges: MscServiceChargeItem[];
  /** GFT + service charges + cabin price. */
  computedTotal: number | null;
}

export interface MscSearchResult {
  bestPrice: {
    cruiseId: string | null;
    shipCd: string | null;
    shipName: string | null;
    departureDate: string | null;
    category: string | null;
    priceCode: string | null;
    cabinPrice: number | null;
    totalCabinPrice: number | null;
    cabinsAvailable: number | null;
  } | null;
  cruises: MscSearchCruise[];
}

function parseServiceCharges(block: string): MscServiceChargeItem[] {
  const [section] = readTags(block, "ServiceChargeItems");
  if (!section) return [];
  return readTags(section, "ServiceChargeItemDetails").map((d) => ({
    type: readTag(d, "ServiceChargeType"),
    code: readTag(d, "ServiceChargeCode"),
    adult: num(readTag(d, "ServiceChargeAdult")),
    child: num(readTag(d, "ServiceChargeChild")),
    junior: num(readTag(d, "ServiceChargeJunior")),
    senior: num(readTag(d, "ServiceChargeSenior")),
    infant: num(readTag(d, "ServiceChargeinfant")),
    total: num(readTag(d, "TotalServiceCharge")),
    standard: (readTag(d, "Standard") ?? "").toLowerCase() === "true",
  }));
}

/**
 * Cabin price already includes NCF, so the total adds port charges and the
 * service-charge total only. `PortChargesAmt` is the cabin-level figure when
 * present; otherwise fall back to per-person GFT * priced occupancy.
 */
function computeTotal(c: Omit<MscSearchCruise, "computedTotal">): number | null {
  const base = c.totalCabinPrice ?? c.cabinPrice;
  if (base === null) return null;
  const occupancy = c.pricedOccupancy ?? 2;
  const port = c.portChargesAmt ?? (c.gftAdult !== null ? c.gftAdult * occupancy : 0);
  const service = c.serviceCharges.reduce((sum, s) => sum + (s.total ?? 0), 0);
  return Math.round((base + port + service) * 100) / 100;
}

export function parseSearchCruisesResponse(xml: string): MscSearchResult {
  const [itinerary] = readTags(xml, "Itinerary");
  const scope = itinerary ?? xml;

  const [bp] = readTags(scope, "BestPrice");
  const bestPrice = bp
    ? {
        cruiseId: readTag(bp, "BestPriceCruiseId"),
        shipCd: readTag(bp, "BestPriceShipCd"),
        shipName: readTag(bp, "BestPriceShipName"),
        departureDate: readTag(bp, "BestPriceDepartureDate"),
        category: readTag(bp, "BestPriceCategory"),
        priceCode: readTag(bp, "BestPriceCode"),
        cabinPrice: num(readTag(bp, "BestPriceCabinPrice")),
        totalCabinPrice: num(readTag(bp, "BestPriceTotalCabinPrice")),
        cabinsAvailable: num(readTag(bp, "BestPriceCabinsAvailable")),
      }
    : null;

  const cruises = readTags(scope, "Cruises").map((b) => {
    const partial = {
      cruiseId: readTag(b, "CruiseId"),
      shipCd: readTag(b, "ShipCd"),
      shipName: readTag(b, "ShipName"),
      departureDate: readTag(b, "DepartureDate"),
      arrivalDate: readTag(b, "ArrivalDate"),
      cruiseLen: num(readTag(b, "CruiseLen")),
      embarkPort: readTag(b, "EmbkPort"),
      embarkPortDesc: readTag(b, "EmbkPortDesc"),
      disembarkPort: readTag(b, "DisembkPort"),
      disembarkPortDesc: readTag(b, "DisembkPortDesc"),
      category: readTag(b, "Category"),
      macroCategory: readTag(b, "MacroCategory"),
      pricedCategory: readTag(b, "PricedCategory"),
      pricedOccupancy: num(readTag(b, "PricedOccupancy")),
      maximumOccupancy: num(readTag(b, "MaximumOccupancy")),
      priceCode: readTag(b, "PriceCode"),
      priceType: readTag(b, "PriceType"),
      priceDesc: readTag(b, "PriceDesc"),
      currency: readTag(b, "CurrencyCd"),
      cabinPrice: num(readTag(b, "CabinPrice")),
      totalCabinPrice: num(readTag(b, "TotalCabinPrice")),
      firstPaxPrice: num(readTag(b, "FirstPaxPrice")),
      secondPaxPrice: num(readTag(b, "SecondPaxPrice")),
      singlePrice: num(readTag(b, "SngPrice")),
      portChargesAmt: num(readTag(b, "PortChargesAmt")),
      gftAdult: num(readTag(b, "GFTTAdt")),
      gftChild: num(readTag(b, "GFTTChd")),
      gftSingle: num(readTag(b, "GFTSng")),
      ncfAdult: num(readTag(b, "NCFTAdt")),
      cabinsAvailable: num(readTag(b, "CabinsAvailable")),
      guaranteesAvailable: num(readTag(b, "GuaranteesAvailable")),
      totalAvailable: num(readTag(b, "TotalAvailable")),
      instantConfirm: readTag(b, "InstantConfirm"),
      airMandatory: (readTag(b, "AirMandatory") ?? "").toLowerCase() === "true",
      commissionAmt: num(readTag(b, "CommissionAmt")),
      serviceCharges: parseServiceCharges(b),
    };
    return { ...partial, computedTotal: computeTotal(partial) };
  });

  return { bestPrice, cruises };
}
