import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X, Loader2 } from "lucide-react";
import { usePayoutDraft, useConfirmPayout } from "@/hooks/useCommissionSplits";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

export function ConfirmPayoutBar() {
  const { drafts, count, clearAll } = usePayoutDraft();
  const confirm = useConfirmPayout();

  const total = useMemo(
    () => Object.values(drafts).reduce((s, d) => s + d.total, 0),
    [drafts]
  );

  if (count === 0) return null;

  const handleConfirm = async () => {
    await confirm.mutateAsync(Object.values(drafts));
    clearAll();
  };

  return (
    <div className="sticky bottom-4 z-40 mx-auto max-w-4xl rounded-xl border bg-background shadow-lg px-5 py-3 flex items-center gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold">
          {count} payout line{count === 1 ? "" : "s"} staged
          <span className="text-muted-foreground font-normal"> · {fmt(total)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Nothing saves until you confirm.
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={clearAll} disabled={confirm.isPending}>
        <X className="h-4 w-4 mr-1" /> Discard all
      </Button>
      <Button size="sm" onClick={handleConfirm} disabled={confirm.isPending}>
        {confirm.isPending ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4 mr-1" />
        )}
        Confirm payout
      </Button>
    </div>
  );
}