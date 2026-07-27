import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

interface Booking {
  id: string;
  confirmation_number?: string;
  booking_reference?: string;
  supplier_id?: string | null;
  total_price?: number;
  total_amount?: number;
  supplier_payout?: number;
  status: string;
  supplier_paid_status?: string;
  supplier_paid_date?: string | null;
  supplier_paid_amount?: number;
  supplier_paid_method?: string | null;
  suppliers?: { name: string } | null;
}

interface SupplierPaymentStatusProps {
  bookings: Booking[];
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  paid: { label: "Paid", color: "bg-success/10 text-success", icon: CheckCircle2 },
  partial: { label: "Partial", color: "bg-info/10 text-info", icon: Clock },
  unpaid: { label: "Unpaid", color: "bg-warning/10 text-warning", icon: Clock },
};

export function SupplierPaymentStatus({ bookings }: SupplierPaymentStatusProps) {
  if (!bookings.length) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const totalDue = bookings.reduce((s, b) => s + (b.supplier_payout || 0), 0);
  const totalPaid = bookings.reduce((s, b) => s + (b.supplier_paid_amount || 0), 0);
  const allPaid = bookings.every((b) => (b.supplier_paid_status || "unpaid") === "paid");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Supplier Payments
          {allPaid ? (
            <Badge variant="secondary" className="ml-auto bg-success/10 text-success text-xs">
              All Paid
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-auto bg-warning/10 text-warning text-xs">
              {formatCurrency(totalDue - totalPaid)} outstanding
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {bookings.map((booking) => {
          const paidStatus = booking.supplier_paid_status || "unpaid";
          const supplierName = (booking as any).suppliers?.name || "No supplier";
          const info = statusConfig[paidStatus] || statusConfig.unpaid;
          const Icon = info.icon;

          const rowColor = paidStatus === "paid"
            ? "border-l-green-500"
            : paidStatus === "partial"
            ? "border-l-blue-500"
            : "border-l-amber-400";

          return (
            <div
              key={booking.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border border-l-4 bg-card",
                rowColor
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/bookings/${booking.id}`}
                    className="text-sm font-medium truncate text-primary hover:underline"
                  >
                    {booking.confirmation_number || booking.booking_reference || booking.id.slice(0, 8)}
                  </Link>
                  <span className="text-xs text-muted-foreground">•</span>
                  <p className="text-xs text-muted-foreground truncate">{supplierName}</p>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">
                    Due: {formatCurrency(booking.supplier_payout || 0)}
                  </p>
                  {paidStatus !== "unpaid" && (
                    <>
                      <span className="text-xs text-muted-foreground">•</span>
                      <p className="text-xs text-muted-foreground">
                        Paid: {formatCurrency(booking.supplier_paid_amount || 0)}
                      </p>
                    </>
                  )}
                  {booking.supplier_paid_date && (
                    <>
                      <span className="text-xs text-muted-foreground">•</span>
                      <p className="text-xs text-muted-foreground">
                        {format(parseLocalDate(booking.supplier_paid_date), "MMM d")}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <Badge variant="secondary" className={cn("text-xs gap-1", info.color)}>
                <Icon className="h-3 w-3" />
                {info.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
