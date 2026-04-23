import { Loader2 } from "lucide-react";
import { CruiseCardSkeleton } from "./CruiseCardSkeleton";

export function CruiseLoadingState() {
  return (
    <div className="relative">
      {/* Skeleton background */}
      <div className="space-y-4 opacity-40 pointer-events-none">
        {Array.from({ length: 3 }).map((_, i) => (
          <CruiseCardSkeleton key={i} />
        ))}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 flex items-start justify-center pt-20">
        <div className="bg-card border rounded-lg shadow-lg px-8 py-6 max-w-md text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="font-medium">
            Please wait while we are searching the best cruise options for you
          </p>
          <p className="text-sm text-muted-foreground">
            Please wait. Do not close this window.
          </p>
        </div>
      </div>
    </div>
  );
}