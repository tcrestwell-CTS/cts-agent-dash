import { DashboardLayout } from "@/components/layout/DashboardLayout";
import AgentHealthPanel from "@/components/AgentHealthPanel";

export default function Kandi() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Agents Health</h1>
          <p className="text-sm text-muted-foreground">Agent monitoring dashboard</p>
        </div>
        <AgentHealthPanel />
      </div>
    </DashboardLayout>
  );
}
