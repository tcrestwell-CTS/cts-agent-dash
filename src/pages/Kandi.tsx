import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AgentHealthPanel from "@/components/AgentHealthPanel";
import { RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Bot, Zap, Brain, Heart, Shield, Megaphone, Database } from "lucide-react";

const AGENTS = [
  {
    name: "Tiara",
    number: 1,
    role: "Lead Qualification",
    description: "Scores incoming leads using AI, tags service area fit, and routes qualified prospects to the next stage automatically.",
    icon: Brain,
    color: "hsl(var(--primary))",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    trigger: "Form submission",
  },
  {
    name: "Richard",
    number: 2,
    role: "Follow-up Sequence",
    description: "Sends personalized follow-up emails to qualified leads on a timed drip sequence to keep prospects engaged.",
    icon: Zap,
    color: "hsl(var(--accent))",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    trigger: "Lead qualified",
  },
  {
    name: "Terrance",
    number: 3,
    role: "Proposal Draft",
    description: "Generates trip proposal drafts via n8n workflow when a lead is marked qualified, ready for advisor review.",
    icon: Bot,
    color: "hsl(142 71% 45%)",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    trigger: "Qualified → n8n",
  },
  {
    name: "Chris",
    number: 4,
    role: "Pre-Trip Nurture",
    description: "Sends milestone emails like 'You're Booked,' '4 Months Out,' and '1 Month Out' plus prep checklists to travelers.",
    icon: Heart,
    color: "hsl(24 95% 53%)",
    badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    trigger: "Trip status: booked",
  },
  {
    name: "Kandi",
    number: 5,
    role: "Reconciliation",
    description: "Monitors bookings, invoices, and commissions for discrepancies. Flags missing invoices, unpaid balances, and QBO desyncs.",
    icon: Shield,
    color: "hsl(45 93% 47%)",
    badgeColor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    trigger: "DB changes + daily cron",
  },
  {
    name: "Google Ads",
    number: 6,
    role: "Ads Conversion Tracking",
    description: "Posts offline conversion events to Google Ads when leads are qualified or booked, optimizing ad spend automatically.",
    icon: Megaphone,
    color: "hsl(330 81% 60%)",
    badgeColor: "bg-pink-500/10 text-pink-400 border-pink-500/30",
    trigger: "Qualified / Booked",
  },
  {
    name: "Portal Leads",
    number: 7,
    role: "DB Connectivity",
    description: "Verifies database connectivity and ensures lead data flows correctly between the portal and backend systems.",
    icon: Database,
    color: "hsl(215 16% 47%)",
    badgeColor: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    trigger: "Health check",
  },
];

const STATUS_CHART_DATA = AGENTS.map((a, i) => ({
  name: a.name,
  value: 100,
  fill: a.color,
})).reverse();

export default function Kandi() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Agents Health</h1>
          <p className="text-sm text-muted-foreground">Agent monitoring dashboard — all 7 agents at a glance</p>
        </div>

        {/* Agent Cards Grid with Individual Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            const gaugeData = [
              { value: 100, fill: agent.color },
              { value: 0, fill: "transparent" },
            ];
            return (
              <Card key={agent.name} className="relative overflow-hidden border-border/50 hover:border-border transition-colors">
                <div
                  className="absolute top-0 left-0 w-1 h-full"
                  style={{ background: agent.color }}
                />
                <CardHeader className="pb-2 pl-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center w-9 h-9 rounded-lg"
                        style={{ background: `${agent.color}20` }}
                      >
                        <Icon className="h-4.5 w-4.5" style={{ color: agent.color }} />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold text-foreground">
                          {agent.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{agent.role}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[0.65rem] ${agent.badgeColor}`}>
                      Agent {agent.number}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pl-5 pb-4">
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    {agent.description}
                  </p>

                  {/* Individual circular gauge */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-16 h-16 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={gaugeData}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            innerRadius="70%"
                            outerRadius="100%"
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={0}
                          >
                            {gaugeData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-foreground">100%</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[0.68rem] text-muted-foreground">
                        <span className="font-medium text-foreground">Status:</span> Online
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[0.68rem] text-muted-foreground font-medium">
                          {agent.trigger}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Live Health Panel */}
        <AgentHealthPanel />
      </div>
    </DashboardLayout>
  );
}
