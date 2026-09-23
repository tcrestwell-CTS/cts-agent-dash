import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelHeader, PanelBody } from "@/components/patterns/Panel";
import { backOfficeSections } from "@/lib/backOfficeNav";
import { AccountIntegrityPanel } from "@/components/backoffice/AccountIntegrityPanel";

export default function BackOffice() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Agency Back Office</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Financial statements, reconciliation, payouts and accounting sync. Restricted to admins and bookkeepers.
          </p>
        </header>

        {backOfficeSections
          .filter((s) => s.label !== "Overview")
          .map((section) => (
            <Panel key={section.label}>
              <PanelHeader title={section.label} />
              <PanelBody>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent hover:bg-accent/5"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/80">
                        <item.icon className="h-4.5 w-4.5" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground group-hover:text-accent">
                          {item.name}
                        </span>
                        {item.description && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              </PanelBody>
            </Panel>
          ))}
      </div>
    </DashboardLayout>
  );
}