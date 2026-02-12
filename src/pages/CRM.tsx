import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";
import { useClientWithBookings } from "@/hooks/useClients";
import { useIsAdmin } from "@/hooks/useAdmin";
import { AddClientDialog } from "@/components/crm/AddClientDialog";
import { ClientCard } from "@/components/crm/ClientCard";
import { ImportDataDialog } from "@/components/admin/ImportDataDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBanner } from "@/components/layout/PageBanner";

type StatusFilter = "all" | "active" | "lead" | "inactive" | "traveled" | "traveling" | "cancelled";

const CRM = () => {
  const { data: clients, isLoading, error } = useClientWithBookings();
  const { data: isAdmin } = useIsAdmin();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredClients = useMemo(() => {
    if (!clients) return [];

    return clients.filter((client) => {
      const matchesSearch =
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.last_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || client.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [clients, searchQuery, statusFilter]);

  const statusCounts = useMemo(() => {
    if (!clients) return { all: 0, active: 0, lead: 0, inactive: 0, traveled: 0, traveling: 0, cancelled: 0 };

    return clients.reduce(
      (acc, client) => {
        acc.all += 1;
        if (client.status === "active") acc.active += 1;
        else if (client.status === "lead") acc.lead += 1;
        else if (client.status === "inactive") acc.inactive += 1;
        else if (client.status === "traveled") acc.traveled += 1;
        else if (client.status === "traveling") acc.traveling += 1;
        else if (client.status === "cancelled") acc.cancelled += 1;
        return acc;
      },
      { all: 0, active: 0, lead: 0, inactive: 0, traveled: 0, traveling: 0, cancelled: 0 }
    );
  }, [clients]);

  return (
    <DashboardLayout>
      <PageBanner
        title="Client Management"
        subtitle="Manage your clients and track their journey"
      >
        {isAdmin && <ImportDataDialog />}
        <AddClientDialog />
      </PageBanner>

      {/* Search and Filters */}
      <div className="bg-card rounded-xl p-4 shadow-card border border-border/50 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            {(["all", "active", "lead", "inactive", "traveled", "traveling", "cancelled"] as StatusFilter[]).map(
              (status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className="capitalize"
                >
                  {status} ({statusCounts[status]})
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-card rounded-xl p-5 shadow-card border border-border/50"
            >
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-12 w-12 rounded-full" />
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
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center">
          <p className="text-destructive font-medium">Failed to load clients</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error.message}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredClients.length === 0 && (
        <div className="bg-card rounded-xl p-12 shadow-card border border-border/50 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {clients?.length === 0
              ? "No clients yet"
              : "No matching clients"}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {clients?.length === 0
              ? "Start building your client base by adding your first client."
              : "Try adjusting your search or filter to find what you're looking for."}
          </p>
          <div className="flex justify-center gap-2">
            {clients?.length === 0 && (
              <>
                {isAdmin && <ImportDataDialog />}
                <AddClientDialog />
              </>
            )}
          </div>
        </div>
      )}

      {/* Clients Grid */}
      {!isLoading && !error && filteredClients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default CRM;
