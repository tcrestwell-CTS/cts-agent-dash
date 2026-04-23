import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Users, BarChart3 } from "lucide-react";
import { useAllTrainingProgress } from "@/hooks/useTrainingProgress";
import { useTrainingModulesV2 } from "@/hooks/useTrainingModulesV2";
import { useTrainingPhases } from "@/hooks/useTrainingPhases";
import { useTeamProfiles } from "@/hooks/useTeamProfiles";

export function AdminReporting() {
  const { data: allProgress } = useAllTrainingProgress();
  const { data: modules } = useTrainingModulesV2();
  const { data: phases } = useTrainingPhases();
  const { data: profiles } = useTeamProfiles();
  const [filter, setFilter] = useState<"all" | "completed" | "in_progress" | "not_started">("all");

  // Build agent progress summary
  const agents = (profiles || []).map(profile => {
    const userId = profile.user_id;
    const userProgress = (allProgress || []).filter(p => p.user_id === userId);
    const modProgress = userProgress.filter(p => p.module_id && !p.lesson_id);
    const completedModules = modProgress.filter(p => p.status === "completed").length;
    const totalModules = modules?.length || 0;
    const pct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
    const lastActive = userProgress.reduce((latest, p) => {
      const d = p.last_viewed_at || p.created_at;
      return d > latest ? d : latest;
    }, "");

    // Determine current phase
    let currentPhase = "Not started";
    if (completedModules > 0 && phases && modules) {
      for (const phase of phases) {
        const phaseModules = modules.filter(m => m.phase_id === phase.id);
        const done = phaseModules.every(m => modProgress.some(p => p.module_id === m.id && p.status === "completed"));
        if (!done) { currentPhase = phase.title; break; }
        currentPhase = "All complete";
      }
    }

    const status = completedModules === 0 ? "not_started" : pct === 100 ? "completed" : "in_progress";

    return {
      userId,
      name: profile.full_name || "Unknown",
      completedModules,
      totalModules,
      pct,
      currentPhase,
      lastActive,
      status,
    };
  });

  const filteredAgents = filter === "all" ? agents : agents.filter(a => a.status === filter);

  const exportCSV = () => {
    const headers = ["Agent", "Progress %", "Modules Completed", "Current Phase", "Last Active"];
    const rows = filteredAgents.map(a => [a.name, `${a.pct}%`, `${a.completedModules}/${a.totalModules}`, a.currentPhase, a.lastActive ? new Date(a.lastActive).toLocaleDateString() : "Never"]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "training-progress-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Agent Progress
        </h2>
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={v => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Agent</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Progress</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Modules</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Current Phase</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Last Active</th>
              <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">No agents found</td></tr>
            ) : (
              filteredAgents.map(agent => (
                <tr key={agent.userId} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="p-3 text-sm font-medium text-card-foreground">{agent.name}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${agent.pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{agent.pct}%</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{agent.completedModules}/{agent.totalModules}</td>
                  <td className="p-3 text-sm text-muted-foreground">{agent.currentPhase}</td>
                  <td className="p-3 text-xs text-muted-foreground">{agent.lastActive ? new Date(agent.lastActive).toLocaleDateString() : "—"}</td>
                  <td className="p-3">
                    <Badge variant={agent.status === "completed" ? "default" : agent.status === "in_progress" ? "secondary" : "outline"} className="text-[10px]">
                      {agent.status === "completed" ? "Complete" : agent.status === "in_progress" ? "In Progress" : "Not Started"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
