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
import { Plus, Filter, Download, Eye, Pencil } from "lucide-react";

const bookings = [
  {
    id: "BK-2026-001",
    client: "Sarah Johnson",
    destination: "Maldives - Soneva Fushi",
    departDate: "Mar 15, 2026",
    returnDate: "Mar 22, 2026",
    travelers: 2,
    status: "confirmed",
    total: "$12,450",
    commission: "$1,245",
  },
  {
    id: "BK-2026-002",
    client: "Michael Chen",
    destination: "Swiss Alps - Zermatt",
    departDate: "Apr 2, 2026",
    returnDate: "Apr 10, 2026",
    travelers: 4,
    status: "pending",
    total: "$8,200",
    commission: "$820",
  },
  {
    id: "BK-2026-003",
    client: "Emma Williams",
    destination: "Tokyo, Japan",
    departDate: "Mar 28, 2026",
    returnDate: "Apr 5, 2026",
    travelers: 2,
    status: "confirmed",
    total: "$6,800",
    commission: "$680",
  },
  {
    id: "BK-2026-004",
    client: "David Brown",
    destination: "Santorini, Greece",
    departDate: "May 1, 2026",
    returnDate: "May 8, 2026",
    travelers: 2,
    status: "pending",
    total: "$9,100",
    commission: "$910",
  },
  {
    id: "BK-2026-005",
    client: "Lisa Anderson",
    destination: "Bali, Indonesia",
    departDate: "May 15, 2026",
    returnDate: "May 25, 2026",
    travelers: 3,
    status: "confirmed",
    total: "$7,500",
    commission: "$750",
  },
  {
    id: "BK-2026-006",
    client: "Robert Taylor",
    destination: "Iceland Aurora Tour",
    departDate: "Jun 1, 2026",
    returnDate: "Jun 8, 2026",
    travelers: 2,
    status: "draft",
    total: "$5,400",
    commission: "$540",
  },
];

const Bookings = () => {
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50">
          <p className="text-sm text-muted-foreground">Total Bookings</p>
          <p className="text-2xl font-semibold text-card-foreground">156</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50">
          <p className="text-sm text-muted-foreground">Confirmed</p>
          <p className="text-2xl font-semibold text-success">124</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-semibold text-accent">28</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow-card border border-border/50">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-semibold text-card-foreground">$245,600</p>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking ID</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Travelers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium">{booking.id}</TableCell>
                <TableCell>{booking.client}</TableCell>
                <TableCell>{booking.destination}</TableCell>
                <TableCell>
                  {booking.departDate} - {booking.returnDate}
                </TableCell>
                <TableCell>{booking.travelers}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={
                      booking.status === "confirmed"
                        ? "bg-success/10 text-success"
                        : booking.status === "pending"
                        ? "bg-accent/10 text-accent"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {booking.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{booking.total}</TableCell>
                <TableCell className="text-success font-medium">
                  {booking.commission}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
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
      </div>
    </DashboardLayout>
  );
};

export default Bookings;
