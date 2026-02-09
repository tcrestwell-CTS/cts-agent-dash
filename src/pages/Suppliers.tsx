import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SupplierManagement } from "@/components/suppliers/SupplierManagement";

export default function Suppliers() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Suppliers</h1>
          <p className="text-muted-foreground mt-1">
            Manage supplier commission rules and vendor relationships
          </p>
        </div>

        {/* Supplier Management */}
        <SupplierManagement />
      </div>
    </DashboardLayout>
  );
}
