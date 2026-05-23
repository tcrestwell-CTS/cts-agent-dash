import { DashboardLayout } from "@/components/layout/DashboardLayout";
import StripeReconcilePanel from "@/components/reconciliation/StripeReconcilePanel";

export default function ReconStripe() {
  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-semibold">Stripe Reconciliation</h1>
          <p className="text-muted-foreground text-sm">
            Match Stripe payments to bookings and resolve mismatched or orphaned charges.
          </p>
        </div>
        <StripeReconcilePanel />
      </div>
    </DashboardLayout>
  );
}