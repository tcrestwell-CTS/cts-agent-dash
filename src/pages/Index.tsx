import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { usePermissions } from "@/hooks/usePermissions";

const Index = () => {
  const { isBookkeeper, isAdmin, isOfficeAdmin, isLoading } = usePermissions();

  if (isLoading) return null;

  // Bookkeeper-only users land on the bookkeeper dashboard
  if (isBookkeeper && !isAdmin && !isOfficeAdmin) {
    return <Navigate to="/bookkeeper" replace />;
  }

  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
};

export default Index;
