import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, MinusCircle } from "lucide-react";
import type { SyncState } from "@/hooks/useQboPaymentSyncStatus";

export function PaymentSyncStatusBadge({ state }: { state: SyncState }) {
  if (state === "synced")
    return <Badge className="bg-success hover:bg-success"><CheckCircle2 className="w-3 h-3 mr-1" />Synced</Badge>;
  if (state === "failed")
    return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
  if (state === "pending")
    return <Badge className="bg-warning hover:bg-warning"><Clock className="w-3 h-3 mr-1" />Unpaid</Badge>;
  return <Badge variant="secondary"><MinusCircle className="w-3 h-3 mr-1" />Not eligible</Badge>;
}
