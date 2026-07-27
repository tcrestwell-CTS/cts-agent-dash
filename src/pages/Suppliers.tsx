import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SupplierManagement } from "@/components/suppliers/SupplierManagement";

export default function Suppliers() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="mb-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
            Crestwell Travel Services
          </p>
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Suppliers</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Manage supplier commission rules and vendor relationships</p>
        </div>

        {/* Supplier Management */}
        <SupplierManagement />
      </div>
    </DashboardLayout>
  );
}
