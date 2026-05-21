import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface Props {
  title: string;
  description?: string;
}

export function BookkeeperPlaceholder({ title, description }: Props) {
  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
        <Card>
          <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-3">
            <Construction className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-md">
              This view is being built as part of Phase 3 of the Bookkeeper
              rollout. Data access and read-only RLS are already in place.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function BookkeeperPL() {
  return (
    <BookkeeperPlaceholder
      title="Profit & Loss"
      description="Computed locally from trip payments and supplier expenses."
    />
  );
}