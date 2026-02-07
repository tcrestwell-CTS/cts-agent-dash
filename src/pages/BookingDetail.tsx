import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  FileText,
  ExternalLink,
  Pencil,
  Trash2,
  User,
  Mail,
  Phone,
  Clock,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useBooking, useBookings } from "@/hooks/useBookings";
import { EditBookingDialog } from "@/components/bookings/EditBookingDialog";

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "confirmed":
      return "bg-success/10 text-success";
    case "pending":
      return "bg-accent/10 text-accent";
    case "traveling":
      return "bg-info/10 text-info";
    case "traveled":
      return "bg-primary/10 text-primary";
    case "cancelled":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "MMMM d, yyyy");
  } catch {
    return dateStr;
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const BookingDetail = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { booking, loading, error } = useBooking(bookingId);
  const { updateBooking, updateBookingStatus, deleteBooking, updating, updatingStatus } = useBookings();
  
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    if (booking) {
      const success = await deleteBooking(booking.id);
      if (success) {
        navigate("/bookings");
      }
    }
    setShowDeleteDialog(false);
  };

  const tripDuration = booking
    ? differenceInDays(new Date(booking.return_date), new Date(booking.depart_date)) + 1
    : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !booking) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Booking Not Found</h2>
            <p className="text-muted-foreground">
              The booking you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => navigate("/bookings")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Bookings
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/bookings")}
            className="mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">
                {booking.trip_name || booking.destination}
              </h1>
              <Select
                value={booking.status}
                onValueChange={(value) => updateBookingStatus(booking.id, value)}
                disabled={updatingStatus}
              >
                <SelectTrigger className="w-auto h-8 px-2 border-0 bg-transparent">
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
                    <Badge variant="secondary" className="bg-accent/10 text-accent">pending</Badge>
                  </SelectItem>
                  <SelectItem value="confirmed">
                    <Badge variant="secondary" className="bg-success/10 text-success">confirmed</Badge>
                  </SelectItem>
                  <SelectItem value="traveling">
                    <Badge variant="secondary" className="bg-info/10 text-info">traveling</Badge>
                  </SelectItem>
                  <SelectItem value="traveled">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">traveled</Badge>
                  </SelectItem>
                  <SelectItem value="cancelled">
                    <Badge variant="secondary" className="bg-destructive/10 text-destructive">cancelled</Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-muted-foreground mt-1">
              Booking Reference: {booking.booking_reference}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {booking.trip_page_url && (
            <Button variant="outline" asChild>
              <a href={booking.trip_page_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View in Tern
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trip Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                Trip Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Destination</p>
                <p className="font-medium text-foreground">{booking.destination}</p>
              </div>
              {booking.trip_name && booking.trip_name !== booking.destination && (
                <div>
                  <p className="text-sm text-muted-foreground">Trip Name</p>
                  <p className="font-medium text-foreground">{booking.trip_name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Travelers</p>
                <p className="font-medium text-foreground">
                  {booking.travelers} {booking.travelers === 1 ? "traveler" : "travelers"}
                </p>
              </div>
              {booking.owner_agent && (
                <div>
                  <p className="text-sm text-muted-foreground">Booking Agent</p>
                  <p className="font-medium text-foreground">{booking.owner_agent}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Travel Dates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Departure</p>
                  <p className="font-medium text-foreground">{formatDate(booking.depart_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Return</p>
                  <p className="font-medium text-foreground">{formatDate(booking.return_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium text-foreground">
                    {tripDuration} {tripDuration === 1 ? "day" : "days"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {booking.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{booking.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatCurrency(booking.total_amount)}
                </p>
              </div>
              {booking.travelers > 1 && (
                <div>
                  <p className="text-sm text-muted-foreground">Per Traveler</p>
                  <p className="font-medium text-foreground">
                    {formatCurrency(booking.total_amount / booking.travelers)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client Info */}
          {booking.clients && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  Client
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Link
                    to={`/crm/${booking.client_id}`}
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {booking.clients.name}
                  </Link>
                  <Badge
                    variant="outline"
                    className="ml-2 text-xs capitalize"
                  >
                    {booking.clients.status}
                  </Badge>
                </div>
                {booking.clients.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${booking.clients.email}`}
                      className="text-foreground hover:text-primary"
                    >
                      {booking.clients.email}
                    </a>
                  </div>
                )}
                {booking.clients.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${booking.clients.phone}`}
                      className="text-foreground hover:text-primary"
                    >
                      {booking.clients.phone}
                    </a>
                  </div>
                )}
                {booking.clients.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{booking.clients.location}</span>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                  <Link to={`/crm/${booking.client_id}`}>View Full Profile</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Record Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="text-foreground">
                  {booking.created_at ? formatDate(booking.created_at) : "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Updated</p>
                <p className="text-foreground">
                  {booking.updated_at ? formatDate(booking.updated_at) : "Unknown"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditBookingDialog
        booking={booking}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSubmit={updateBooking}
        updating={updating}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the booking for{" "}
              <span className="font-medium">{booking.trip_name || booking.destination}</span>
              {booking.clients?.name && <> ({booking.clients.name})</>}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default BookingDetail;
