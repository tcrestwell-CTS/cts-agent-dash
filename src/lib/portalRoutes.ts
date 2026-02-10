// Portal route configuration
// After remixing to a standalone portal project, change PREFIX to "" to make routes top-level
export const PORTAL_PREFIX = "/portal";

export const portalRoutes = {
  login: `${PORTAL_PREFIX}/login`,
  verify: `${PORTAL_PREFIX}/verify`,
  dashboard: PORTAL_PREFIX || "/",
  trips: `${PORTAL_PREFIX}/trips`,
  tripDetail: (tripId: string) => `${PORTAL_PREFIX}/trips/${tripId}`,
  invoices: `${PORTAL_PREFIX}/invoices`,
  messages: `${PORTAL_PREFIX}/messages`,
} as const;
