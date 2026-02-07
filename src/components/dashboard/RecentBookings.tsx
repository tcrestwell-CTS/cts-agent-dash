import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, User } from "lucide-react";

const bookings = [
  {
    id: 1,
    client: "Sarah Johnson",
    destination: "Maldives",
    dates: "Mar 15 - Mar 22, 2026",
    status: "confirmed",
    amount: "$12,450",
  },
  {
    id: 2,
    client: "Michael Chen",
    destination: "Swiss Alps",
    dates: "Apr 2 - Apr 10, 2026",
    status: "pending",
    amount: "$8,200",
  },
  {
    id: 3,
    client: "Emma Williams",
    destination: "Tokyo, Japan",
    dates: "Mar 28 - Apr 5, 2026",
    status: "confirmed",
    amount: "$6,800",
  },
  {
    id: 4,
    client: "David Brown",
    destination: "Santorini, Greece",
    dates: "May 1 - May 8, 2026",
    status: "pending",
    amount: "$9,100",
  },
];

export function RecentBookings() {
  return (
    <div className="bg-card rounded-xl shadow-card border border-border/50">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-card-foreground">
          Recent Bookings
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Your latest travel arrangements
        </p>
      </div>
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
                  <p className="font-medium text-card-foreground">
                    {booking.client}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {booking.destination}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {booking.dates}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge
                  variant={
                    booking.status === "confirmed" ? "default" : "secondary"
                  }
                  className={
                    booking.status === "confirmed"
                      ? "bg-success/10 text-success hover:bg-success/20 border-0"
                      : "bg-accent/10 text-accent hover:bg-accent/20 border-0"
                  }
                >
                  {booking.status}
                </Badge>
                <span className="font-semibold text-card-foreground min-w-[80px] text-right">
                  {booking.amount}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
