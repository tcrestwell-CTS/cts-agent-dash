import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SupplierManagement } from "@/components/suppliers/SupplierManagement";
import { PageBanner } from "@/components/layout/PageBanner";

export default function Suppliers() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PageBanner
          title="Suppliers"
          subtitle="Manage supplier commission rules and vendor relationships"
        />

        {/* Supplier Management */}
        <SupplierManagement />
      </div>
    </DashboardLayout>
  );
}
