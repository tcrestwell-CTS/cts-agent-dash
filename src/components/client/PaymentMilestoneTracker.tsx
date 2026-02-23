import { CheckCircle2, Circle, Clock } from "lucide-react";
import { format } from "date-fns";

interface Payment {
  id: string;
  payment_type: string;
  amount: number;
  status: string;
  due_date: string | null;
  payment_date: string;
}

interface PaymentMilestoneTrackerProps {
  payments: Payment[];
  totalCost: number;
}

export function PaymentMilestoneTracker({ payments, totalCost }: PaymentMilestoneTrackerProps) {
  if (payments.length === 0) return null;

  const sorted = [...payments].sort((a, b) => {
    const dateA = a.due_date || a.payment_date;
    const dateB = b.due_date || b.payment_date;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  const totalPaid = sorted
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const progress = totalCost > 0 ? Math.min((totalPaid / totalCost) * 100, 100) : 0;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const typeLabel = (type: string) =>
    type === "final_balance" ? "Final Balance" : type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Payment Progress</span>
        <span className="text-muted-foreground">
          {formatCurrency(totalPaid)} of {formatCurrency(totalCost)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Milestones */}
      <div className="space-y-3">
        {sorted.map((payment) => {
          const isPaid = payment.status === "paid";
          const isPending = payment.status === "pending";
          const date = payment.due_date || payment.payment_date;

          return (
            <div key={payment.id} className="flex items-center gap-3">
              {isPaid ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              ) : isPending ? (
                <Clock className="h-5 w-5 text-amber-500 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isPaid ? "text-green-700" : "text-foreground"}`}>
                  {typeLabel(payment.payment_type)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPaid ? "Paid" : "Due"}{" "}
                  {date && format(new Date(date), "MMM d, yyyy")}
                </p>
              </div>
              <span className={`text-sm font-semibold ${isPaid ? "text-green-700" : "text-foreground"}`}>
                {formatCurrency(payment.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
