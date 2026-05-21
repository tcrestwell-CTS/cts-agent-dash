import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

interface Props {
  children: React.ReactNode;
}

export function BookkeeperRoute({ children }: Props) {
  const { isBookkeeper, isAdmin, isOfficeAdmin, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!isBookkeeper && !isAdmin && !isOfficeAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}