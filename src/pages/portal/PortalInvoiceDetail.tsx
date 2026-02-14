import { useParams, useNavigate } from "react-router-dom";
import { usePortalInvoiceDetail } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ArrowLeft, FileText, MapPin, Calendar, Users } from "lucide-react";

export default function PortalInvoiceDetail() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = usePortalInvoiceDetail(invoiceId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (!data?.invoice) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>Invoice not found.</p>
        <Button variant="link" onClick={() => navigate("/portal/invoices")}>
          Back to Invoices
        </Button>
      </div>
    );
  }

  const { invoice, bookings = [], payments = [] } = data;

  const statusVariant = invoice.status === "paid" ? "default" : invoice.status === "partial" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/portal/invoices")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Button>

      {/* Invoice Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{invoice.invoice_number}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Issued {format(new Date(invoice.invoice_date), "MMMM d, yyyy")}
                {invoice.trip_name && ` · ${invoice.trip_name}`}
              </p>
            </div>
            <Badge variant={statusVariant} className="text-sm">{invoice.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-lg font-bold">${invoice.total_amount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid</p>
              <p className="text-lg font-bold text-green-600">${invoice.amount_paid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className="text-lg font-bold text-orange-600">${invoice.amount_remaining.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings / Line Items */}
      {bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookings.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">{b.booking_reference}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {b.destination}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {format(new Date(b.depart_date), "MMM d")} – {format(new Date(b.return_date), "MMM d, yyyy")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {b.travelers}
                    </span>
                  </div>
                </div>
                <p className="font-semibold text-sm">${b.total_amount.toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payments */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments Received</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{p.details || p.payment_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.payment_date), "MMM d, yyyy")}
                  </p>
                </div>
                <p className="font-semibold text-sm text-green-600">+${p.amount.toLocaleString()}</p>
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold text-sm">
              <span>Total Paid</span>
              <span className="text-green-600">${invoice.amount_paid.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
