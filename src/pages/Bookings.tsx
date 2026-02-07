import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, Download, Eye, Pencil, Trash2, ExternalLink, Loader2, Search, X } from "lucide-react";
import { format } from "date-fns";
import { useBookings, Booking } from "@/hooks/useBookings";
import { AddBookingDialog } from "@/components/bookings/AddBookingDialog";
import { EditBookingDialog } from "@/components/bookings/EditBookingDialog";

const Bookings = () => {
  const { bookings, loading, creating, updating, updatingStatus, isAdmin, createBooking, updateBooking, updateBookingStatus, deleteBooking } = useBookings();
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Filter bookings based on search and filters
  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          booking.destination?.toLowerCase().includes(query) ||
          booking.trip_name?.toLowerCase().includes(query) ||
          booking.booking_reference?.toLowerCase().includes(query) ||
          booking.clients?.name?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== "all" && booking.status !== statusFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== "all") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const departDate = new Date(booking.depart_date);
        const returnDate = new Date(booking.return_date);

        switch (dateFilter) {
          case "upcoming":
            if (departDate < today) return false;
            break;
          case "ongoing":
            if (departDate > today || returnDate < today) return false;
            break;
          case "past":
            if (returnDate >= today) return false;
            break;
        }
      }

      return true;
    });
  }, [bookings, searchQuery, statusFilter, dateFilter]);

  const activeFiltersCount = [
    statusFilter !== "all",
    dateFilter !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter("all");
    setDateFilter("all");
    setSearchQuery("");
  };

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
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bookings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="start">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date Range</label>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All dates" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All dates</SelectItem>
                        <SelectItem value="upcoming">Upcoming trips</SelectItem>
                        <SelectItem value="ongoing">Ongoing trips</SelectItem>
                        <SelectItem value="past">Past trips</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {activeFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={clearFilters}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {filteredBookings.length !== bookings.length && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredBookings.length} of {bookings.length} bookings
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            {bookings.length === 0 ? (
              <>
                <p>No bookings found</p>
                <p className="text-sm">Import trips or create a new booking to get started</p>
              </>
            ) : (
              <>
                <p>No bookings match your filters</p>
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Clear filters
                </Button>
              </>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trip Name</TableHead>
                <TableHead>Client</TableHead>
                {isAdmin && <TableHead>Agent</TableHead>}
                <TableHead>Dates</TableHead>
                <TableHead>Travelers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings.map((booking) => (
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
                  {isAdmin && (
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {booking.owner_agent || "—"}
                      </span>
                    </TableCell>
                  )}
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
