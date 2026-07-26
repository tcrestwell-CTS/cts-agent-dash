import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, LayoutGrid, List } from "lucide-react";
import { useClientWithBookings } from "@/hooks/useClients";
import { useIsAdmin } from "@/hooks/useAdmin";
import { AddClientDialog } from "@/components/crm/AddClientDialog";
import { ClientCard } from "@/components/crm/ClientCard";
import { ClientListView } from "@/components/crm/ClientListView";
import { ImportDataDialog } from "@/components/admin/ImportDataDialog";
import { ExportCustomersTripsButton } from "@/components/crm/ExportCustomersTripsButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Panel, PanelBody, EmptyState } from "@/components/patterns/Panel";


type StatusFilter = "all" | "active" | "lead" | "inactive" | "traveled" | "travelling" | "cancelled";

const TAB_CONFIG: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Clients" },
  { value: "active", label: "Active" },
  { value: "lead", label: "Leads" },
  { value: "traveled", label: "Traveled" },
  { value: "inactive", label: "Inactive" },
  { value: "cancelled", label: "Cancelled" },
];

const CRM = () => {
  const { data: clients, isLoading, error } = useClientWithBookings();
  const { data: isAdmin } = useIsAdmin();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const statusCounts = useMemo(() => {
    if (!clients) return { all: 0, active: 0, lead: 0, inactive: 0, traveled: 0, travelling: 0, cancelled: 0 };

    return clients.reduce(
      (acc, client) => {
        acc.all += 1;
        if (client.status === "active") acc.active += 1;
        else if (client.status === "lead") acc.lead += 1;
        else if (client.status === "inactive") acc.inactive += 1;
        else if (client.status === "traveled") acc.traveled += 1;
        else if (client.status === "travelling") acc.travelling += 1;
        else if (client.status === "cancelled") acc.cancelled += 1;
        return acc;
      },
      { all: 0, active: 0, lead: 0, inactive: 0, traveled: 0, travelling: 0, cancelled: 0 }
    );
  }, [clients]);

  const getFilteredClients = (status: StatusFilter) => {
    if (!clients) return [];
    return clients.filter((client) => {
      const matchesSearch =
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.last_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = status === "all" || client.status === status;
      return matchesSearch && matchesStatus;
    });
  };

  const ClientDisplay = ({ status }: { status: StatusFilter }) => {
    const filtered = getFilteredClients(status);

    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
          {[...Array(6)].map((_, i) => (
            <Panel key={i} className="p-[14px]">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Panel>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <Panel className="border-destructive/20 bg-destructive/5 p-[14px] text-center">
          <p className="text-[13.5px] font-semibold text-destructive">Failed to load clients</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{error.message}</p>
        </Panel>
      );
    }

    if (filtered.length === 0) {
      return (
        <Panel>
          <EmptyState
            title={clients?.length === 0 ? "No clients yet" : "No matching clients"}
            message={
              clients?.length === 0
                ? "Start building your client base by adding your first client."
                : "Try adjusting your search or filter to find what you're looking for."
            }
            action={
              clients?.length === 0 && (
                <div className="flex justify-center gap-2">
                  {isAdmin && <ImportDataDialog />}
                  <AddClientDialog />
                </div>
              )
            }
          />
        </Panel>
      );
    }

    if (viewMode === "list") {
      return <ClientListView clients={filtered} />;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
        {filtered.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Client Management</h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">Manage your clients and track their journey</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportCustomersTripsButton />
            {isAdmin && <ImportDataDialog />}
            <AddClientDialog />
          </div>
        </div>

        {/* Search */}
        <Panel>
          <PanelBody className="flex items-center justify-between gap-4">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="h-10 rounded-[8px] pl-9 text-[13.5px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 rounded-[8px] border border-border p-0.5">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-[6px]"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-[6px]"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </PanelBody>
        </Panel>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusFilter)}>
          <TabsList className="h-auto flex-wrap gap-1 rounded-[8px] bg-muted/50 p-1">
            {TAB_CONFIG.map(({ value, label }) => {
              const count = value === "all"
                ? statusCounts.all
                : value === "traveled"
                ? statusCounts.traveled
                : value === "lead"
                ? statusCounts.lead
                : value === "active"
                ? statusCounts.active
                : value === "inactive"
                ? statusCounts.inactive
                : statusCounts.cancelled;

              return (
                <TabsTrigger key={value} value={value} className="text-[12.5px]">
                  {label}
                  <span className="ml-1.5 rounded-full bg-background/60 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                    {count}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {TAB_CONFIG.map(({ value }) => (
            <TabsContent key={value} value={value} className="mt-[18px]">
              <ClientDisplay status={value} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default CRM;
