import { DashboardLayout } from "@/components/layout/DashboardLayout";
import ViatorPanel from "@/components/ViatorPanel";
import ClientExcursionRequests from "@/components/suppliers/ClientExcursionRequests";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        <Tabs defaultValue="search">
          <TabsList>
            <TabsTrigger value="search">Search &amp; bookings</TabsTrigger>
            <TabsTrigger value="requests">Client requests</TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="mt-6">
            <ViatorPanel />
          </TabsContent>
          <TabsContent value="requests" className="mt-6">
            <ClientExcursionRequests />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
