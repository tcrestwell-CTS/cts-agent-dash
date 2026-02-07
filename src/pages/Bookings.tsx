import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Filter, Download, Eye, Pencil, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Booking {
  id: string;
  booking_reference: string;
  destination: string;
  depart_date: string;
  return_date: string;
  travelers: number;
  total_amount: number;
  status: string;
  trip_name: string | null;
  trip_page_url: string | null;
  owner_agent: string | null;
  clients: {
    name: string;
  } | null;
}

const Bookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    pending: 0,
    completed: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          booking_reference,
          destination,
          depart_date,
          return_date,
          travelers,
          total_amount,
          status,
          trip_name,
          trip_page_url,
          owner_agent,
          clients (
            name
          )
        `)
        .order("depart_date", { ascending: false });

      if (error) throw error;

      setBookings(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const confirmed = data?.filter((b) => b.status === "confirmed").length || 0;
      const pending = data?.filter((b) => b.status === "pending").length || 0;
      const completed = data?.filter((b) => b.status === "completed").length || 0;
      const totalRevenue = data?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

      setStats({ total, confirmed, pending, completed, totalRevenue });
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-success/10 text-success";
      case "pending":
        return "bg-accent/10 text-accent";
      case "completed":
        return "bg-primary/10 text-primary";
      case "cancelled":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            Booking Portal
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage all your travel bookings in one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Booking
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50">
          <p className="text-sm text-muted-foreground">Total Bookings</p>
          <p className="text-2xl font-semibold text-card-foreground">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50">
          <p className="text-sm text-muted-foreground">Confirmed</p>
          <p className="text-2xl font-semibold text-success">{stats.confirmed}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-semibold text-accent">{stats.pending}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-semibold text-primary">{stats.completed}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-semibold text-card-foreground">
            {formatCurrency(stats.totalRevenue)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p>No bookings found</p>
            <p className="text-sm">Import trips or create a new booking to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trip Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Travelers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {booking.trip_name || booking.destination}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {booking.booking_reference}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{booking.clients?.name || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span>{formatDate(booking.depart_date)}</span>
                      <span className="text-muted-foreground">
                        to {formatDate(booking.return_date)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{booking.travelers}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={getStatusBadgeClass(booking.status)}
                    >
                      {booking.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(booking.total_amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {booking.trip_page_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                        >
                          <a
                            href={booking.trip_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View in Tern Travel"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Bookings;
