import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { useIsAdmin } from "@/hooks/useAdmin";
import { usePeriodLock } from "@/hooks/usePeriodLock";

interface Props {
  year: number;
  month: number; // 1-12
}

const monthLabel = (year: number, month: number) =>
  format(new Date(year, month - 1, 1), "MMMM yyyy");

export function PeriodLockButton({ year, month }: Props) {
  const { data: isAdmin } = useIsAdmin();
  const { isLocked, lockedAt, lockPeriod, unlockPeriod, isLoading } = usePeriodLock(year, month);
  const [open, setOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [notes, setNotes] = useState("");

  if (isLoading) return null;

  // Locked badge (visible to everyone)
  const lockedBadge = isLocked ? (
    <Badge
      variant="outline"
      className="border-amber-500/60 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <Lock className="h-3 w-3 mr-1" />
      Closed
      {lockedAt && <span className="ml-1 opacity-70">· {format(new Date(lockedAt), "MMM d")}</span>}
    </Badge>
  ) : null;

  // Bookkeeper (non-admin) view: status only
  if (!isAdmin) {
    if (!isLocked) return null;
    return (
      <span className="text-sm text-muted-foreground inline-flex items-center gap-2">
        {lockedBadge}
        {lockedAt && (
          <span>Period closed {format(new Date(lockedAt), "MMM d, yyyy")}</span>
        )}
      </span>
    );
  }

  // Admin view: badge + action button
  return (
    <div className="flex items-center gap-2">
      {lockedBadge}
      {isLocked ? (
        <>
          <Button variant="outline" size="sm" onClick={() => setUnlockOpen(true)}>
            <LockOpen className="h-4 w-4 mr-2" /> Unlock
          </Button>
          <AlertDialog open={unlockOpen} onOpenChange={setUnlockOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unlock {monthLabel(year, month)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Edits to payments and commissions in this period will be allowed again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      await unlockPeriod.mutateAsync();
                      toast.success(`${monthLabel(year, month)} unlocked`);
                      setUnlockOpen(false);
                    } catch (e: any) {
                      toast.error(e?.message ?? "Failed to unlock period");
                    }
                  }}
                >
                  Unlock
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Lock className="h-4 w-4 mr-2" /> Lock Month
          </Button>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Lock {monthLabel(year, month)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  No further edits to payments or commissions will be allowed in this period.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="lock-notes" className="text-sm">Notes (optional)</Label>
                <Textarea
                  id="lock-notes"
                  placeholder="Reason or context for the close…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setNotes("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      await lockPeriod.mutateAsync(notes || undefined);
                      toast.success(`${monthLabel(year, month)} locked`);
                      setNotes("");
                      setOpen(false);
                    } catch (e: any) {
                      toast.error(e?.message ?? "Failed to lock period");
                    }
                  }}
                >
                  Lock period
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}