import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortalInvoices } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { format } from "date-fns";

export default function PortalInvoices() {
  const { data, isLoading } = usePortalInvoices();

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </PortalLayout>
    );
  }

  const invoices = data?.invoices || [];

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground mt-1">View your invoices and payment status</p>
        </div>

        {invoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No invoices yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {invoices.map((inv: any) => (
              <Card key={inv.id}>
                <CardContent className="flex items-center justify-between p-6">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{inv.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {inv.trip_name || "Invoice"}
                      {inv.invoice_date && ` · ${format(new Date(inv.invoice_date), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-semibold text-lg">${Number(inv.total_amount).toLocaleString()}</p>
                    {inv.amount_remaining > 0 ? (
                      <p className="text-sm text-orange-600">
                        ${Number(inv.amount_remaining).toLocaleString()} remaining
                      </p>
                    ) : (
                      <Badge variant="default" className="bg-green-600">Paid</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
