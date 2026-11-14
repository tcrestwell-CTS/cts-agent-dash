import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkSupplierPaidButton } from "../components/trips/MarkSupplierPaidButton";

const mocks = vi.hoisted(() => ({ from: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

async function confirm() {
  render(<MarkSupplierPaidButton paymentId="receipt" amount={300} paymentStatus="paid" />);
  fireEvent.click(screen.getByTestId("button-mark-supplier-paid"));
  fireEvent.click(screen.getByTestId("button-confirm-supplier-paid"));
}

describe("manual supplier payment confirmation", () => {
  it("blocks an unlinked receipt without changing any booking or payment", async () => {
    const update = vi.fn();
    mocks.from.mockReturnValue({ update, select: () => ({ eq: () => ({ single: async () => ({
      data: { booking_id: null, trip_id: "flight-and-hotel", amount: 300, supplier_paid_at: null }, error: null,
    }) }) }) });
    await confirm();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Link this payment")));
    expect(update).not.toHaveBeenCalled();
    expect(mocks.from.mock.calls).toEqual([["trip_payments"]]);
  });
  it("saves only the linked receipt flag and lets the atomic trigger apply the actual $300", async () => {
    const update = vi.fn((_payload: Record<string, unknown>) => ({ eq: () => ({ is: () => ({ select: () => ({ single: async () => ({ data: { id: "receipt" }, error: null }) }) }) }) }));
    mocks.from.mockReturnValue({ update, select: () => ({ eq: () => ({ single: async () => ({
      data: { booking_id: "hotel", trip_id: "flight-and-hotel", amount: 300, supplier_paid_at: null }, error: null,
    }) }) }) });
    await confirm();
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]).toEqual({
      supplier_paid_at: expect.any(String), supplier_payment_method: "agency_card", supplier_payment_ref: null,
    });
    expect(mocks.from.mock.calls).toEqual([["trip_payments"], ["trip_payments"]]);
  });
});