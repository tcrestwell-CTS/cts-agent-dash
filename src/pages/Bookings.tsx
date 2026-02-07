import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Filter, Download, Eye, Pencil, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useBookings, Booking } from "@/hooks/useBookings";
import { AddBookingDialog } from "@/components/bookings/AddBookingDialog";
import { EditBookingDialog } from "@/components/bookings/EditBookingDialog";

const Bookings = () => {
  const { bookings, loading, creating, updating, updatingStatus, createBooking, updateBooking, updateBookingStatus, deleteBooking } = useBookings();
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    pending: bookings.filter((b) => b.status === "pending").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    totalRevenue: bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0),
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
          <AddBookingDialog onSubmit={createBooking} creating={creating} />
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
                    <Select
                      value={booking.status}
                      onValueChange={(value) => updateBookingStatus(booking.id, value)}
                      disabled={updatingStatus}
                    >
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue>
                          <Badge
                            variant="secondary"
                            className={getStatusBadgeClass(booking.status)}
                          >
                            {booking.status}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">
                          <Badge variant="secondary" className="bg-accent/10 text-accent">
                            pending
                          </Badge>
                        </SelectItem>
                        <SelectItem value="confirmed">
                          <Badge variant="secondary" className="bg-success/10 text-success">
                            confirmed
                          </Badge>
                        </SelectItem>
                        <SelectItem value="completed">
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            completed
                          </Badge>
                        </SelectItem>
                        <SelectItem value="cancelled">
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                            cancelled
                          </Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingBooking(booking)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingBooking(booking)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <EditBookingDialog
        booking={editingBooking}
        open={!!editingBooking}
        onOpenChange={(open) => !open && setEditingBooking(null)}
        onSubmit={updateBooking}
        updating={updating}
      />

      <AlertDialog open={!!deletingBooking} onOpenChange={(open) => !open && setDeletingBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the booking for{" "}
              <span className="font-medium">{deletingBooking?.trip_name || deletingBooking?.destination}</span>
              {deletingBooking?.clients?.name && (
                <> ({deletingBooking.clients.name})</>
              )}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deletingBooking) {
                  await deleteBooking(deletingBooking.id);
                  setDeletingBooking(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Bookings;
