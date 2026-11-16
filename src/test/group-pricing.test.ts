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
  it("prices an Obama solo package with only hotel allocation changing, 5% overhead and 10% profit margin", () => {
    const soloBase = 1442 + 30;
    const option = { ...veranda, price_per_person: Math.ceil(soloBase * 1.05 / 0.90 * 100) / 100, single_supplement_pct: 0, deposit_amount: 300, sleeps_min: 1, sleeps_max: 1 };
    const q = quoteBooking([{ cabin_option_id: "v1", adults: 1, children: 0 }], [option], [], [], cfg);
    expect(q.total).toBe(1717.34);
    expect(Math.round((q.total - 876.17) * 100) / 100).toBe(841.17);
    expect(q.deposit_due).toBe(300);
    expect(q.total - q.deposit_due).toBe(1417.34);
  });
  it("divides the Obama 20-guest Hyatt Place and museum total with 5% overhead and 10% profit margin", () => {
    const supplierTotal = 10 * 1442 + 20 * 30;
    const overheadTotal = supplierTotal * 0.05;
    const packagePP = Math.ceil((supplierTotal + overheadTotal) / 0.90 / 20 * 100) / 100;
    const option = { ...veranda, price_per_person: packagePP, deposit_amount: 300, sleeps_min: 2, sleeps_max: 2 };
    const q = quoteBooking(Array.from({ length: 10 }, () => ({ cabin_option_id: "v1", adults: 2, children: 0 })), [option], [], [], { ...cfg, group_deposit_per_person: 300 });
    expect(supplierTotal).toBe(15020);
    expect(overheadTotal).toBe(751);
    expect(q.total).toBe(17523.40);
    expect((q.total - supplierTotal - overheadTotal) / q.total).toBeCloseTo(0.10, 5);
    expect(q.rooms[0].per_person_display).toBe(876.17);
  });
  it("keeps the Obama $300 per-person deposit, leaving $1,152.34 for two", () => {
    const option = { ...veranda, price_per_person: 876.17, deposit_amount: 300 };
    const q = quoteBooking([{ cabin_option_id: "v1", adults: 2, children: 0 }], [option], [], [], cfg);
    expect(q.deposit_due).toBe(600);
    expect(q.total - q.deposit_due).toBe(1152.34);
  });
  it.each([["river", 45, 52.50], ["dinner", 125, 145.84], ["citypass", 144, 168], ["food", 101, 117.84]])("charges the optional %s only when selected", (id, supplier, price) => {
    const option = { ...veranda, price_per_person: 876.17, deposit_amount: 300 };
    const addons = [{ id: String(id), name: String(id), price: Math.ceil(Number(supplier) * 1.05 / 0.90 * 100 - 1e-8) / 100, price_basis: "per_person" as const }];
    const rooms = [{ cabin_option_id: "v1", adults: 2, children: 0 }];
    expect(addons[0].price).toBe(price);
    expect(quoteBooking(rooms, [option], addons, [], cfg).total).toBe(1752.34);
    const selected = quoteBooking(rooms, [option], addons, [{ addon_id: String(id), quantity: 1 }], cfg);
    expect(selected.addons_total).toBe(Number(price) * 2);
    expect(selected.deposit_due).toBe(600);
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
