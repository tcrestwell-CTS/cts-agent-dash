import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CruiseCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <Skeleton className="h-48 sm:h-auto sm:w-64 shrink-0 rounded-none" />
        <div className="flex-1 p-5 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          <div className="flex justify-between items-end pt-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>
    </Card>
  );
}