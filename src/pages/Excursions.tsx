import { DashboardLayout } from "@/components/layout/DashboardLayout";
import ViatorPanel from "@/components/ViatorPanel";

export default function Excursions() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Excursions</h1>
          <p className="text-muted-foreground text-sm mt-1">Search and manage Viator activities and bookings</p>
        </div>
        <ViatorPanel />
      </div>
    </DashboardLayout>
  );
}
