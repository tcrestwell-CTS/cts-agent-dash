import { describe, expect, it } from "vitest";
import { resolveSupplierBooking } from "../../supabase/functions/_shared/supplier-booking";

function database(bookings: Record<string, unknown>[], payments: Record<string, unknown>[]) {
  const lookups: Array<{ table: string; field: string; value: unknown }> = [];
  const db = {
    from(table: string) {
      return { select() { return { eq(field: string, value: unknown) {
        lookups.push({ table, field, value });
        return { async maybeSingle() {
          const rows = table === "bookings" ? bookings : payments;
          return { data: rows.find(row => row[field] === value) ?? null, error: null };
        } };
      } }; } };
    },
  };
  return { db, lookups };
}

describe("supplier payments require an explicit booking", () => {
  const flight = { id: "flight", trip_id: "trip", supplier_payout: 1200 };
  const hotel = { id: "hotel", trip_id: "trip", supplier_payout: 900 };
  it("does not choose the oldest flight for an unlinked payment on a flight-and-hotel trip", async () => {
    const { db, lookups } = database([flight, hotel], [{ id: "payment", trip_id: "trip", booking_id: null, amount: 300 }]);
    expect(await resolveSupplierBooking(db, { id: "payment", trip_id: "trip" })).toBeNull();
    expect(lookups).toEqual([
      { table: "bookings", field: "id", value: "payment" },
      { table: "trip_payments", field: "id", value: "payment" },
    ]);
  });
  it("resolves the hotel only when the payment is explicitly linked to it", async () => {
    const { db } = database([flight, hotel], [{ id: "payment", trip_id: "trip", booking_id: "hotel" }]);
    expect(await resolveSupplierBooking(db, { id: "payment" })).toEqual(hotel);
  });
  it("rejects a linked booking from a different trip", async () => {
    const { db } = database([flight, hotel], [{ id: "payment", trip_id: "other", booking_id: "hotel" }]);
    expect(await resolveSupplierBooking(db, { id: "payment" })).toBeNull();
  });
  it("continues to resolve direct booking-trigger events", async () => {
    const { db } = database([flight, hotel], []);
    expect(await resolveSupplierBooking(db, { id: "hotel" })).toEqual(hotel);
  });
});