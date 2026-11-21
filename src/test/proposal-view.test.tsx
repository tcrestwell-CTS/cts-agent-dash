import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProposalView from "@/pages/ProposalView";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

const proposal = {
  first_name: "Test Traveler", destination: "Chicago", proposal_draft: "Test itinerary",
  proposal_status: "sent", selected_option: "chosen", proposal_expires_at: "2099-01-01T00:00:00Z",
};
let stored: Record<string, unknown> | null;
let approvalResult: string | null;

function open() {
  return render(<HelmetProvider><MemoryRouter initialEntries={["/proposal/test-token"]}>
    <Routes><Route path="/proposal/:token" element={<ProposalView />} /></Routes>
  </MemoryRouter></HelmetProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  stored = { ...proposal };
  approvalResult = "approved";
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "get_proposal") return { data: stored ? [{ ...stored }] : [], error: null };
    if (name === "approve_proposal") {
      if (approvalResult === "approved" && stored) stored.proposal_status = "approved";
      return { data: approvalResult, error: null };
    }
    return { data: null, error: null };
  });
});
afterEach(cleanup);

const approvalCalls = () => mocks.rpc.mock.calls.filter(([name]) => name === "approve_proposal");

describe("individual proposal approval", () => {
  it.each(["sent", "viewed"])("tracks a valid %s proposal through the existing RPC, without client-side notifications", async (status) => {
    stored = { ...proposal, proposal_status: status };
    open();
    await screen.findByRole("button");
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "mark_proposal_viewed")).toEqual([
      ["mark_proposal_viewed", { p_token: "test-token" }],
    ]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("records the selected option once and reopens approved without another write", async () => {
    const view = open();
    const button = await screen.findByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByRole("status");
    expect(approvalCalls()).toEqual([["approve_proposal", { p_token: "test-token", p_option: "chosen" }]]);
    expect(screen.queryByRole("button")).toBeNull();
    view.unmount();
    open();
    await screen.findByRole("status");
    expect(approvalCalls()).toHaveLength(1);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each(["approved", "converted"])("reopens an older %s proposal even after pricing expiry", async (status) => {
    stored = { ...proposal, proposal_status: status, proposal_expires_at: "2020-01-01T00:00:00Z" };
    open();
    await screen.findByRole("status");
    expect(screen.queryByRole("button")).toBeNull();
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["get_proposal"]);
  });

  it.each(["no-trip", "awaiting-advisor", "traveler-details", "card-authorization", "direct-payment"])(
    "does not infer access for %s from unverified linked records", async (scenario) => {
      stored = { ...proposal, proposal_status: "approved", converted_trip_id: scenario === "no-trip" ? null : "private-trip",
        next_action: scenario, next_action_url: "/pay?token=not-authorized" };
      open();
      await screen.findByRole("status");
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.queryByRole("button")).toBeNull();
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["get_proposal"]);
    },
  );

  it.each(["not_approvable", "unexpected", null])("rejects unsuccessful RPC result %s and allows retry", async (result) => {
    approvalResult = result;
    open();
    fireEvent.click(await screen.findByRole("button"));
    await screen.findByRole("alert");
    expect(screen.queryByRole("status")).toBeNull();
    expect(mocks.success).not.toHaveBeenCalled();
    approvalResult = "approved";
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("status");
    expect(approvalCalls()).toHaveLength(2);
  });

  it.each(["returned", "thrown"])("handles a %s network error without claiming approval", async (failure) => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "get_proposal") return { data: [proposal], error: null };
      if (name === "approve_proposal") {
        if (failure === "thrown") throw new Error("offline");
        return { data: null, error: { message: "offline" } };
      }
      return { data: null, error: null };
    });
    open();
    fireEvent.click(await screen.findByRole("button"));
    await screen.findByRole("alert");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button")).toBeEnabled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("handles a concurrent approval without resubmitting", async () => {
    approvalResult = "already_approved";
    open();
    fireEvent.click(await screen.findByRole("button"));
    await screen.findByRole("status");
    expect(approvalCalls()).toHaveLength(1);
  });

  it.each(["expired", "not_found"])("does not treat server result %s as success", async (result) => {
    approvalResult = result;
    open();
    fireEvent.click(await screen.findByRole("button"));
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
    expect(screen.queryByRole("status")).toBeNull();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("blocks approval when the loaded pricing has expired", async () => {
    stored = { ...proposal, proposal_expires_at: "2020-01-01T00:00:00Z" };
    open();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("mark_proposal_viewed", { p_token: "test-token" }));
    expect(screen.queryByRole("button")).toBeNull();
    expect(approvalCalls()).toHaveLength(0);
  });

  it("does not approve an invalid link", async () => {
    stored = null;
    open();
    await screen.findByRole("heading");
    expect(screen.queryByRole("button")).toBeNull();
    expect(approvalCalls()).toHaveLength(0);
  });
});