import { useState } from "react";
import { usePortalPayments } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Receipt, DollarSign, Clock, CheckCircle2, XCircle, Loader2, ExternalLink, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: any; className: string }> = {
  paid: { label: "Paid", variant: "default", icon: CheckCircle2, className: "bg-green-100 text-green-700 border-green-200" },
  pending: { label: "Pending", variant: "secondary", icon: Clock, className: "bg-amber-100 text-amber-700 border-amber-200" },
  authorized: { label: "Authorized", variant: "outline", icon: CreditCard, className: "bg-blue-100 text-blue-700 border-blue-200" },
  refunded: { label: "Refunded", variant: "outline", icon: DollarSign, className: "bg-purple-100 text-purple-700 border-purple-200" },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle, className: "bg-red-100 text-red-700 border-red-200" },
};

export default function PortalPayments() {
  const { data, isLoading, refetch } = usePortalPayments();
  const payments = data?.payments || [];
  const [payingId, setPayingId] = useState<string | null>(null);

  const handlePayNow = async (paymentId: string) => {
    setPayingId(paymentId);
    try {
      const portalSession = localStorage.getItem("portal_session");
      const portalToken = portalSession ? JSON.parse(portalSession).token : null;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-payment`, {
        method: "POST",
        headers: {
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "x-portal-token": portalToken || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentId, returnUrl: window.location.origin }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to start payment. Please try again.");
    } finally {
      setPayingId(null);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const formatPaymentType = (type: string) =>
    type === "final_balance" ? "Final Balance" : type.charAt(0).toUpperCase() + type.slice(1);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  const paidPayments = payments.filter((p: any) => p.status === "paid");
  const pendingPayments = payments.filter((p: any) => p.status === "pending");
  const totalPaid = paidPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const totalPending = pendingPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Payment History</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
                <p className="text-sm text-muted-foreground">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
                <p className="text-sm text-muted-foreground">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{payments.length}</p>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payments */}
      {pendingPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> Payments Due ({pendingPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingPayments.map((p: any) => {
              const config = statusConfig[p.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              return (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{formatPaymentType(p.payment_type)}</p>
                      <span className="text-xs text-muted-foreground">· {p.trip_name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {p.due_date ? `Due ${format(new Date(p.due_date), "MMM d, yyyy")}` : "Due date pending"}
                    </p>
                    {p.details && <p className="text-xs text-muted-foreground">{p.details}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold">{formatCurrency(p.amount)}</p>
                    <Button
                      size="sm"
                      onClick={() => handlePayNow(p.id)}
                      disabled={payingId === p.id}
                    >
                      {payingId === p.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-1" />
                      )}
                      Pay Now
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* All Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" /> All Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No payment history yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Date</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Description</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Trip</th>
                    <th className="pb-3 font-medium text-sm text-muted-foreground">Method</th>
                     <th className="pb-3 font-medium text-sm text-muted-foreground">Status</th>
                     <th className="pb-3 font-medium text-sm text-muted-foreground text-right">Amount</th>
                     <th className="pb-3 font-medium text-sm text-muted-foreground text-center">Receipt</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {payments.map((p: any) => {
                     const config = statusConfig[p.status] || statusConfig.pending;
                     const StatusIcon = config.icon;
                     return (
                       <tr key={p.id} className="hover:bg-muted/50">
                         <td className="py-3 text-sm">
                           {format(new Date(p.payment_date), "MMM d, yyyy")}
                         </td>
                         <td className="py-3">
                           <p className="font-medium text-sm">{formatPaymentType(p.payment_type)}</p>
                           {p.details && <p className="text-xs text-muted-foreground">{p.details}</p>}
                         </td>
                         <td className="py-3 text-sm text-muted-foreground">{p.trip_name}</td>
                         <td className="py-3 text-sm text-muted-foreground capitalize">
                           {p.payment_method?.replace(/_/g, " ") || "—"}
                         </td>
                         <td className="py-3">
                           <Badge variant="outline" className={`gap-1 ${config.className}`}>
                             <StatusIcon className="h-3 w-3" />
                             {config.label}
                           </Badge>
                         </td>
                         <td className="py-3 text-right font-semibold text-sm">
                           {formatCurrency(p.amount)}
                         </td>
                         <td className="py-3 text-center">
                           {p.status === "paid" && p.stripe_receipt_url ? (
                             <Button
                               variant="ghost"
                               size="sm"
                               className="gap-1 text-xs"
                               onClick={() => window.open(p.stripe_receipt_url, "_blank")}
                             >
                               <FileText className="h-3.5 w-3.5" />
                               View
                             </Button>
                           ) : p.status === "paid" ? (
                             <span className="text-xs text-muted-foreground">—</span>
                           ) : null}
                         </td>
                       </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
