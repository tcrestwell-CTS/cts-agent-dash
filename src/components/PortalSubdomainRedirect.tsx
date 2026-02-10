import { Navigate, useLocation } from "react-router-dom";

const PORTAL_HOSTNAME = "portal.crestwelltravels.com";

export function useIsPortalSubdomain() {
  return window.location.hostname === PORTAL_HOSTNAME;
}

export function PortalSubdomainRedirect({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isPortal = useIsPortalSubdomain();

  if (isPortal && !location.pathname.startsWith("/portal")) {
    return <Navigate to="/portal/login" replace />;
  }

  return <>{children}</>;
}
