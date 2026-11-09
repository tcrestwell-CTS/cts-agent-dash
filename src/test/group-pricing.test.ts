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
