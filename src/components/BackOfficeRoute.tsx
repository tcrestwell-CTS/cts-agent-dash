import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin, useIsOfficeAdmin, useIsBookkeeper } from "@/hooks/useAdmin";

/**
 * Guards the Agency Back Office (financial + accounting) area.
 * Access: admin, office_admin, bookkeeper only.
 */
export function BackOfficeRoute({ children }: { children: ReactNode }) {
  const { data: isAdmin, isLoading: l1 } = useIsAdmin();
  const { data: isOfficeAdmin, isLoading: l2 } = useIsOfficeAdmin();
  const { data: isBookkeeper, isLoading: l3 } = useIsBookkeeper();

  if (l1 || l2 || l3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/20" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!(isAdmin || isOfficeAdmin || isBookkeeper)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function useHasBackOfficeAccess() {
  const { data: isAdmin, isLoading: l1 } = useIsAdmin();
  const { data: isOfficeAdmin, isLoading: l2 } = useIsOfficeAdmin();
  const { data: isBookkeeper, isLoading: l3 } = useIsBookkeeper();
  return { hasAccess: !!(isAdmin || isOfficeAdmin || isBookkeeper), isLoading: l1 || l2 || l3 };
}