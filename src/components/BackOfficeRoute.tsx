import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * Guards the Agency Back Office (financial + accounting) area.
 * Access: admin, office_admin, bookkeeper only.
 */
export function BackOfficeRoute({ children }: { children: ReactNode }) {
  const { hasAccess, isLoading } = useHasBackOfficeAccess();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/20" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!hasAccess) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export function useHasBackOfficeAccess() {
  const { isAdmin, isOfficeAdmin, isBookkeeper, isLoading } = usePermissions();
  return { hasAccess: !!(isAdmin || isOfficeAdmin || isBookkeeper), isLoading };
}