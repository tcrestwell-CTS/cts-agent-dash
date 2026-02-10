import { Navigate, useLocation } from "react-router-dom";

const PORTAL_HOSTNAMES = ["portal.crestwelltravels.com"];

export function useIsPortalSubdomain() {
  return PORTAL_HOSTNAMES.includes(window.location.hostname);
}

export function PortalSubdomainRedirect({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isPortal = useIsPortalSubdomain();

  // On the portal subdomain, block all non-portal routes (including /auth)
  if (isPortal && !location.pathname.startsWith("/portal") && !["/login", "/verify", "/dashboard", "/trips", "/invoices", "/messages"].some(p => location.pathname === p || location.pathname.startsWith(p + "/"))) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
