import { type ReactNode, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import type { FeatureKey } from "@/lib/featureRegistry";

interface FeatureRouteProps {
  feature: FeatureKey;
  children: ReactNode;
}

/**
 * Route guard that hides a page from agents who don't have the feature
 * permission. Admins and office admins always pass through.
 */
export function FeatureRoute({ feature, children }: FeatureRouteProps) {
  const { can, isLoading } = useFeaturePermissions();
  const toastFired = useRef(false);

  const allowed = can(feature);

  useEffect(() => {
    if (!isLoading && !allowed && !toastFired.current) {
      toastFired.current = true;
      toast.error("You don't have access to this page.");
    }
  }, [isLoading, allowed]);

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

  if (!allowed) return <Navigate to="/" replace />;

  return <>{children}</>;
}