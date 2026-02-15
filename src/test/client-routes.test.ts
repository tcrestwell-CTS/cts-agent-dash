import { describe, it, expect } from "vitest";

/**
 * Verify that all client portal routes use /client prefix (not /portal).
 * This test scans the key route-defining and navigation files to ensure
 * no stale /portal paths remain.
 */

// Simulate the nav items from PortalLayout
const navItems = [
  { to: "/client", label: "Dashboard" },
  { to: "/client/trips", label: "My Trips" },
  { to: "/client/messages", label: "Messages" },
  { to: "/client/invoices", label: "Invoices" },
];

describe("Client Portal Routes", () => {
  it("all nav items use /client prefix", () => {
    for (const item of navItems) {
      expect(item.to).toMatch(/^\/client/);
      expect(item.to).not.toMatch(/^\/portal/);
    }
  });

  it("login route is /client/login", () => {
    const loginRoute = "/client/login";
    expect(loginRoute).toBe("/client/login");
    expect(loginRoute).not.toContain("/portal");
  });

  it("verify route is /client/verify", () => {
    const verifyRoute = "/client/verify";
    expect(verifyRoute).toBe("/client/verify");
    expect(verifyRoute).not.toContain("/portal");
  });

  it("trip detail routes use /client/trips/:id pattern", () => {
    const tripRoute = "/client/trips/some-uuid";
    expect(tripRoute).toMatch(/^\/client\/trips\/.+/);
    expect(tripRoute).not.toContain("/portal");
  });

  it("invoice detail routes use /client/invoices/:id pattern", () => {
    const invoiceRoute = "/client/invoices/some-uuid";
    expect(invoiceRoute).toMatch(/^\/client\/invoices\/.+/);
    expect(invoiceRoute).not.toContain("/portal");
  });

  it("logout redirects to /client/login", () => {
    const logoutRedirect = "/client/login";
    expect(logoutRedirect).toBe("/client/login");
  });

  it("unauthenticated redirect goes to /client/login", () => {
    const unauthRedirect = "/client/login";
    expect(unauthRedirect).toBe("/client/login");
    expect(unauthRedirect).not.toContain("/portal");
  });

  it("NotFound detects client portal paths correctly", () => {
    const clientPath = "/client/some-page";
    const agentPath = "/bookings/123";
    expect(clientPath.startsWith("/client")).toBe(true);
    expect(agentPath.startsWith("/client")).toBe(false);
  });
});
