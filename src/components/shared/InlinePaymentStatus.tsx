import { cn } from "@/lib/utils";
import { Check, Clock, AlertCircle } from "lucide-react";

interface InlinePaymentStatusProps {
  paidAmount?: number;
  totalAmount?: number;
  status?: string;
  type?: "client" | "supplier";
  className?: string;
}

export function InlinePaymentStatus({
  paidAmount = 0,
  totalAmount = 0,
  status,
  type = "client",
  className,
}: InlinePaymentStatusProps) {
  const isPaid   = status === "paid"   || (totalAmount > 0 && paidAmount >= totalAmount);
  const isPartial = !isPaid && paidAmount > 0;
  const isUnpaid  = !isPaid && paidAmount === 0;

  if (isPaid) return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full", className)}>
      <Check className="h-3 w-3" />
      {type === "supplier" ? "Supplier paid" : "Paid"}
    </span>
  );

  if (isPartial) return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full", className)}>
      <Clock className="h-3 w-3" />
      Partial
    </span>
  );

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full", className)}>
      <AlertCircle className="h-3 w-3" />
      {type === "supplier" ? "Supplier unpaid" : "Unpaid"}
    </span>
  );
}
