import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelBody } from "@/components/patterns/Panel";
import { Construction } from "lucide-react";

interface Props {
  title: string;
  description?: string;
}

export function BookkeeperPlaceholder({ title, description }: Props) {
  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div>
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">{title}</h1>
          {description && (
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">{description}</p>
          )}
        </div>
        <Panel>
          <PanelBody className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-card-2 p-3">
              <Construction className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="max-w-md text-[13px] text-muted-foreground">
              This view is being built as part of Phase 3 of the Bookkeeper
              rollout. Data access and read-only RLS are already in place.
            </p>
          </PanelBody>
        </Panel>
      </div>
    </DashboardLayout>
  );
}

// Default export kept for backward compatibility – real P&L lives in BookkeeperPL.tsx
export default function BookkeeperPlaceholderDefault() {
  return <BookkeeperPlaceholder title="Coming Soon" />;
}