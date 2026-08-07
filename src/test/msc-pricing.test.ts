import { describe, it, expect } from "vitest";
import {
  computeMscTotal,
  occupancyKey,
  parseCruiseId,
  parseItemsCell,
  parseMoney,
  parseServiceCharge,
} from "../../supabase/functions/_shared/msc-pricing";

describe("MSC flat-file price arithmetic", () => {
  it("2 adults = 2A + 2*GFT-A + 2*SERVICE-CHARGE-A*NIGHTS", () => {
    const r = computeMscTotal({
      cabinPrice: 1000,
      nights: 7,
      adults: 2,
      gftAdult: 150,
      serviceChargeAdult: "14.50|16.00",
    });
    expect(r.portCharges).toBe(300);
    expect(r.serviceCharges).toBe(203); // 2 * 14.50 * 7
    expect(r.total).toBe(1503);
  });

  it("2 adults 2 children sums both GFT and both service charges", () => {
    const r = computeMscTotal({
      cabinPrice: 1800,
      nights: 7,
      adults: 2,
      children: 2,
      gftAdult: 150,
      gftChild: 100,
      serviceChargeAdult: "14.50|16.00",
      serviceChargeChild: "7.25|8.00",
    });
    expect(r.portCharges).toBe(500); // 2*150 + 2*100
    expect(r.serviceCharges).toBe(304.5); // (2*14.50 + 2*7.25) * 7
    expect(r.total).toBe(2604.5);
  });

  it("uses the STANDARD service charge for pay-on-board", () => {
    const promo = computeMscTotal({ cabinPrice: 1000, nights: 7, adults: 2, serviceChargeAdult: "14.50|16.00" });
    const standard = computeMscTotal({ cabinPrice: 1000, nights: 7, adults: 2, serviceChargeAdult: "14.50|16.00", mode: "standard" });
    expect(promo.serviceCharges).toBe(203);
    expect(standard.serviceCharges).toBe(224);
  });

  it("treats N/A as not applicable", () => {
    expect(parseMoney("N/A")).toBe(0);
    expect(parseServiceCharge("N/A|16.00")).toEqual({ promo: 0, standard: 16 });
    const r = computeMscTotal({ cabinPrice: 500, nights: 5, adults: 1, gftAdult: null, serviceChargeAdult: "N/A|N/A" });
    expect(r.total).toBe(500);
  });

  it("never quotes the bare cabin price when charges exist", () => {
    const r = computeMscTotal({ cabinPrice: 999, nights: 3, adults: 2, gftAdult: 80, serviceChargeAdult: "10|10" });
    expect(r.total).not.toBe(r.cabinPrice);
    expect(r.total).toBe(999 + 160 + 60);
  });
});

describe("MSC flat-file cell parsing", () => {
  it("parses the ITEMS cell", () => {
    expect(parseItemsCell("OBS:DOLCE:S|TRF:TRF0102:O")).toEqual([
      { type: "OBS", code: "DOLCE", applicability: "S" },
      { type: "TRF", code: "TRF0102", applicability: "O" },
    ]);
    expect(parseItemsCell("N/A")).toEqual([]);
    expect(parseItemsCell("")).toEqual([]);
  });

  it("decomposes a composite CruiseID", () => {
    expect(parseCruiseId("EU20260404MRSMRS")).toEqual({
      shipCode: "EU",
      sailDate: "2026-04-04",
      embarkPort: "MRS",
      disembarkPort: "MRS",
    });
    expect(parseCruiseId("not-a-cruise")).toBeNull();
  });

  it("builds occupancy keys", () => {
    expect(occupancyKey(2)).toBe("2A");
    expect(occupancyKey(2, 2)).toBe("2A2C");
    expect(occupancyKey(2, 1, 1)).toBe("2A1C1I");
  });
});