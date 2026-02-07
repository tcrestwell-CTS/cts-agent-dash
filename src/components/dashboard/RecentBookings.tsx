import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, User, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface Booking {
  id: string;
  trip_name: string | null;
  destination: string;
  depart_date: string;
  return_date: string;
  status: string;
  total_amount: number;
  trip_page_url: string | null;
  clients: {
    name: string;
  } | null;
}

export function RecentBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentBookings();
  }, []);

  const fetchRecentBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          trip_name,
          destination,
          depart_date,
          return_date,
          status,
          total_amount,
          trip_page_url,
          clients (
            name
          )
        `)
        .order("depart_date", { ascending: true })
        .limit(5);

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error fetching recent bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateRange = (start: string, end: string) => {
    try {
      const startDate = format(new Date(start), "MMM d");
      const endDate = format(new Date(end), "MMM d, yyyy");
      return `${startDate} - ${endDate}`;
    } catch {
      return `${start} - ${end}`;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-success/10 text-success hover:bg-success/20 border-0";
      case "pending":
        return "bg-accent/10 text-accent hover:bg-accent/20 border-0";
      case "completed":
        return "bg-primary/10 text-primary hover:bg-primary/20 border-0";
      default:
        return "bg-muted text-muted-foreground border-0";
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-card border border-border/50">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-card-foreground">
          Upcoming Trips
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Your latest travel arrangements
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p>No bookings found</p>
          <p className="text-sm">Import trips to see them here</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-card-foreground">
                        {booking.clients?.name || "Unknown Client"}
                      </p>
                      {booking.trip_page_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          asChild
                        >
                          <a
                            href={booking.trip_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {booking.trip_name || booking.destination}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateRange(booking.depart_date, booking.return_date)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge
                    variant="secondary"
                    className={getStatusBadgeClass(booking.status)}
                  >
                    {booking.status}
                  </Badge>
                  <span className="font-semibold text-card-foreground min-w-[80px] text-right">
                    {formatCurrency(booking.total_amount)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
