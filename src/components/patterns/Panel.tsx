import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[11px] border border-border bg-card shadow-card", className)}
      {...props}
    />
  );
}

interface PanelHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PanelHeader({ title, subtitle, actions, className, ...props }: PanelHeaderProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 border-b border-border px-[17px] py-[14px]", className)}
      {...props}
    >
      <div className="min-w-0">
        <h3 className="text-[14.5px] font-semibold text-foreground truncate">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-[14px]", className)} {...props} />;
}

interface EmptyStateProps {
  title: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, message, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center", className)}>
      <div>
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{message}</p>
      </div>
      {action}
    </div>
  );
}
