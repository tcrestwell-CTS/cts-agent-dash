import { DashboardLayout } from "@/components/layout/DashboardLayout";
import ViatorPanel from "@/components/ViatorPanel";

export default function Excursions() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="mb-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
            Crestwell Travel Services
          </p>
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Excursions</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Search and manage Viator activities and bookings</p>
        </div>
        <ViatorPanel />
      </div>
    </DashboardLayout>
  );
}
