import { Navigate, useLocation } from "react-router-dom";

const PORTAL_HOSTNAMES = ["portal.crestwelltravels.com"];

export function useIsPortalSubdomain() {
  return PORTAL_HOSTNAMES.includes(window.location.hostname);
}

export function PortalSubdomainRedirect({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isPortal = useIsPortalSubdomain();

  // On the portal subdomain, block all non-portal routes (including /auth)
  if (isPortal && !location.pathname.startsWith("/portal")) {
    return <Navigate to="/portal/login" replace />;
  }

  return <>{children}</>;
}
