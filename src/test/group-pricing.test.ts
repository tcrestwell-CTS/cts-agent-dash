import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { quoteBooking, type CabinOptionPricing } from "@/lib/groupPricing";

const veranda: CabinOptionPricing = {
  id: "v1", category_group: "Veranda", category_name: "Veranda", price_per_person: 886,
  third_fourth_price: 400, child_price: null, single_supplement_pct: 100, deposit_amount: null,
  sleeps_min: 1, sleeps_max: 4, sold_out: false,
};
const cfg = { taxes_fees_per_person: 0, group_deposit_per_person: 250, promo_codes: [] };

describe("group pricing", () => {
  it("prices an Obama solo package with only hotel allocation changing, 15% overhead and 18% profit margin", () => {
    const soloBase = 1900 + 30 + 45 + 125 + 144 + 101;
    const option = { ...veranda, price_per_person: Math.ceil(soloBase * 1.15 / 0.82 * 100) / 100, single_supplement_pct: 0, deposit_amount: 300, sleeps_min: 1, sleeps_max: 1 };
    const q = quoteBooking([{ cabin_option_id: "v1", adults: 1, children: 0 }], [option], [], [], cfg);
    expect(q.total).toBe(3288.72);
    expect(Math.round((q.total - 1956.41) * 100) / 100).toBe(1332.31);
    expect(q.deposit_due).toBe(300);
    expect(q.total - q.deposit_due).toBe(2988.72);
  });
  it("divides the Obama 20-guest total with CityPASS and food tour, 15% overhead and 18% profit margin", () => {
    const supplierTotal = 10 * 1900 + 20 * (30 + 45 + 125 + 144 + 101);
    const overheadTotal = supplierTotal * 0.15;
    const packagePP = Math.ceil((supplierTotal + overheadTotal) / 0.82 / 20 * 100) / 100;
    const option = { ...veranda, price_per_person: packagePP, deposit_amount: 300, sleeps_min: 2, sleeps_max: 2 };
    const q = quoteBooking(Array.from({ length: 10 }, () => ({ cabin_option_id: "v1", adults: 2, children: 0 })), [option], [], [], { ...cfg, group_deposit_per_person: 300 });
    expect(supplierTotal).toBe(27900);
    expect(overheadTotal).toBe(4185);
    expect(q.total).toBe(39128.20);
    expect((q.total - supplierTotal - overheadTotal) / q.total).toBeGreaterThanOrEqual(0.18);
    expect(q.rooms[0].per_person_display).toBe(1956.41);
  });
  it("keeps the Obama $300 per-person deposit, leaving $3,312.82 for two", () => {
    const option = { ...veranda, price_per_person: 1956.41, deposit_amount: 300 };
    const q = quoteBooking([{ cabin_option_id: "v1", adults: 2, children: 0 }], [option], [], [], cfg);
    expect(q.deposit_due).toBe(600);
    expect(q.total - q.deposit_due).toBe(3312.82);
  });
  it.each([2730, 2450, 12600])("charges the $%s cabin total once regardless of guest count", (amount) => {
    for (const adults of [1, 2]) {
      const opt = { ...veranda, price_period: "cabin", price_per_person: amount };
      const q = quoteBooking([{ cabin_option_id: "v1", adults, children: 0 }], [opt], [], [], cfg);
      expect(q.fare_subtotal).toBe(amount);
      expect(q.deposit_due).toBe(250 * adults);
    }
  });
  it("prices two adults at $886 each (Celebrity example = $1,772)", () => {
    const q = quoteBooking([{ cabin_option_id: "v1", adults: 2, children: 0 }], [veranda], [], [], cfg, null);
    expect(q.fare_subtotal).toBe(1772);
    expect(q.total).toBe(1772);
    expect(q.deposit_due).toBe(500);
  });

  it("charges the single supplement for a solo guest", () => {
    const q = quoteBooking([{ cabin_option_id: "v1", adults: 1, children: 0 }], [veranda], [], [], cfg, null);
    expect(q.fare_subtotal).toBe(1772);
  });

  it("keeps the browser and server pricing files identical", () => {
    const a = readFileSync(resolve(__dirname, "../lib/groupPricing.ts"), "utf8");
    const b = readFileSync(resolve(__dirname, "../../supabase/functions/_shared/group-pricing.ts"), "utf8");
    expect(a).toBe(b);
  });
});
