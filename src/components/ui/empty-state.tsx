import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — centered "nothing here" pattern.
 * 15px/600 title + 13px muted next-action sentence. Optional action slot.
 * Never a shrug: the sentence should tell the user what to do next.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-[13px] text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";