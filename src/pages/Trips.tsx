import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Compass,
  Plus,
  Search,
  Calendar,
  Users,
  MapPin,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import { useTrips } from "@/hooks/useTrips";
import { AddTripDialog } from "@/components/trips/AddTripDialog";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  planning: "bg-blue-100 text-blue-700 border-blue-200",
  booked: "bg-green-100 text-green-700 border-green-200",
  traveling: "bg-purple-100 text-purple-700 border-purple-200",
  completed: "bg-gray-100 text-gray-700 border-gray-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const Trips = () => {
  const navigate = useNavigate();
  const { trips, loading } = useTrips();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const filteredTrips = trips.filter((trip) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      trip.trip_name.toLowerCase().includes(searchLower) ||
      trip.destination?.toLowerCase().includes(searchLower) ||
      trip.clients?.name.toLowerCase().includes(searchLower)
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Trips</h1>
            <p className="text-muted-foreground mt-1">
              Manage client trips and their bookings
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Trip
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trips..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Trips List */}
        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : filteredTrips.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Compass className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  {searchQuery ? "No trips found" : "No trips yet"}
                </p>
                <p className="text-sm mt-1">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Create your first trip to get started"}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="mt-4 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Trip
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTrips.map((trip) => (
              <Card
                key={trip.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/trips/${trip.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <h3 className="text-lg font-semibold truncate">
                          {trip.trip_name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={statusColors[trip.status] || statusColors.planning}
                        >
                          {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                        </Badge>
                        {trip.trip_type && trip.trip_type !== "regular" && (
                          <Badge variant="secondary" className="text-xs">
                            {trip.trip_type}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-4 w-4" />
                          {trip.clients?.name || "Unknown Client"}
                        </span>
                        {trip.destination && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            {trip.destination}
                          </span>
                        )}
                        {trip.depart_date && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(trip.depart_date), "MMM d, yyyy")}
                            {trip.return_date && (
                              <> - {format(new Date(trip.return_date), "MMM d, yyyy")}</>
                            )}
                          </span>
                        )}
                        {trip.trip_page_url && (
                          <a
                            href={trip.trip_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Trip Page
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="flex items-center gap-6 lg:gap-8">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Total Sales
                        </p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(trip.total_gross_sales)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Commission
                        </p>
                        <p className="text-lg font-semibold text-primary">
                          {formatCurrency(trip.total_commission_revenue)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddTripDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </DashboardLayout>
  );
};

export default Trips;
