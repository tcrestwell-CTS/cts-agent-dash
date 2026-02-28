import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Users, MapPin, ExternalLink, Pencil, Trash2, DollarSign, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Booking } from "@/hooks/useBookings";

interface BookingCardProps {
  booking: Booking;
  isAdmin: boolean;
  updatingStatusId: string | null;
  onStatusChange: (id: string, status: string) => void;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
}

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
    return format(new Date(dateStr), "MMM d, yyyy");
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

export function BookingCard({
  booking,
  isAdmin,
  updatingStatusId,
  onStatusChange,
  onEdit,
  onDelete,
}: BookingCardProps) {
  const navigate = useNavigate();

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="combobox"]') || target.closest('a')) {
      return;
    }
    navigate(`/bookings/${booking.id}`);
  };

  return (
    <Card 
      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {booking.trip_name || booking.destination}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {booking.booking_reference}
            </p>
          </div>
          <Select
            value={booking.status}
            onValueChange={(value) => onStatusChange(booking.id, value)}
            disabled={updatingStatusId === booking.id}
          >
            <SelectTrigger className="w-auto h-7 px-2 border-0 bg-transparent">
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
              <SelectItem value="traveling">
                <Badge variant="secondary" className="bg-info/10 text-info">
                  traveling
                </Badge>
              </SelectItem>
              <SelectItem value="traveled">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  traveled
                </Badge>
              </SelectItem>
              <SelectItem value="cancelled">
                <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                  cancelled
                </Badge>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Client */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{booking.clients?.name || "No client"}</span>
          {booking.travelers > 1 && (
            <Badge variant="outline" className="text-xs ml-auto shrink-0">
              {booking.travelers} travelers
            </Badge>
          )}
        </div>

        {/* Destination */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{booking.destination}</span>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>
            {formatDate(booking.depart_date)} — {formatDate(booking.return_date)}
          </span>
        </div>

        {/* Amount */}
        <div className="flex items-center gap-2 text-sm font-medium">
          <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{formatCurrency(booking.total_amount)}</span>
        </div>

        {/* Commission Override Pending Badge */}
        {booking.override_pending_approval && (
          <div className="flex items-center gap-2 p-2 bg-warning/10 border border-warning/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-xs text-warning font-medium">
              Commission override pending approval
            </span>
          </div>
        )}

        {/* High-Value Approval Pending Badge */}
        {booking.approval_required && booking.status === "pending" && (
          <div className="flex items-center gap-2 p-2 bg-accent/10 border border-accent/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
            <span className="text-xs text-accent font-medium">
              High-value booking — pending admin approval
            </span>
          </div>
        )}

        {/* Agent (admin only) */}
        {isAdmin && booking.owner_agent && (
          <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
            Agent: {booking.owner_agent}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 pt-2 border-t border-border/50">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(booking)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(booking)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
