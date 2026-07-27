import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SectionCard — the standard card surface used across every screen.
 * Card: bg-card, 1px border, 11px radius, --shadow-card.
 * Header band: 14px 17px padding with a bottom border; title 14.5px/600, subtitle 12.5px muted.
 */
const SectionCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[11px] border border-border bg-card text-card-foreground shadow-card",
        className,
      )}
      {...props}
    />
  ),
);
SectionCard.displayName = "SectionCard";

type SectionCardHeaderProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
};

const SectionCardHeader = React.forwardRef<HTMLDivElement, SectionCardHeaderProps>(
  ({ className, title, subtitle, actions, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border px-[17px] py-[14px]",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {title !== undefined && (
          <h3 className="truncate text-[14.5px] font-semibold text-foreground">{title}</h3>
        )}
        {subtitle !== undefined && (
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{subtitle}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  ),
);
SectionCardHeader.displayName = "SectionCardHeader";

const SectionCardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-[17px]", className)} {...props} />
  ),
);
SectionCardBody.displayName = "SectionCardBody";

const SectionCardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-end gap-2 border-t border-border px-[17px] py-[12px]",
        className,
      )}
      {...props}
    />
  ),
);
SectionCardFooter.displayName = "SectionCardFooter";

export { SectionCard, SectionCardHeader, SectionCardBody, SectionCardFooter };