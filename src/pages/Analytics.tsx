import React, { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBookings } from "@/hooks/useBookings";
import { useClients } from "@/hooks/useClients";
import { useCommissions } from "@/hooks/useCommissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { AgentPerformanceSection } from "@/components/analytics/AgentPerformanceSection";
import { AgencySalesTab } from "@/components/analytics/AgencySalesTab";
import { AgentIntelligenceTab } from "@/components/analytics/AgentIntelligenceTab";
import { useIsAdmin, useIsOfficeAdmin } from "@/hooks/useAdmin";
import { DateRangeFilter, DateRange } from "@/components/analytics/DateRangeFilter";
import { exportToCSV, formatCurrencyForExport, formatDateForExport } from "@/lib/csvExport";
import { toast } from "sonner";
import type { TooltipProps } from "recharts";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  format,
  parseISO,
  subMonths,
  addMonths,
  isWithinInterval,
  eachMonthOfInterval,
} from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Plane,
  DollarSign,
  Target,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  Trophy,
  Download,
  Brain,
  Database,
  FileText,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function StatCard({
  title, value, change, changeType = "neutral", icon: Icon, description,
}: {
  title: string; value: string; change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ElementType; description?: string;
}) {
  return (
    <Card className="card-clean">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className="p-1.5 rounded-lg bg-muted/50">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {change && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${
            changeType === "positive" ? "text-green-600" :
            changeType === "negative" ? "text-red-500" : "text-muted-foreground"
          }`}>
            {changeType === "positive" ? "↑" : changeType === "negative" ? "↓" : ""}
            {change}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


