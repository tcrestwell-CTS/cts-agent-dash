import { DashboardLayout } from "@/components/layout/DashboardLayout";
import StripeReconcilePanel from "@/components/reconciliation/StripeReconcilePanel";

export default function ReconStripe() {
  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div className="space-y-1">
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Stripe Reconciliation</h1>
          <p className="text-[13.5px] text-muted-foreground">
            Match Stripe payments to bookings and resolve mismatched or orphaned charges.
          </p>
        </div>
        <StripeReconcilePanel />
      </div>
    </DashboardLayout>
  );
}