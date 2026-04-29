import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wand2, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function BackfillPlanningTripsCard() {
  const [count, setCount] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const refresh = async () => {
    const { count: c } = await supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("status", "planning");
    setCount(c ?? 0);
  };

  useEffect(() => { refresh(); }, []);

  const handleBackfill = async () => {
    setRunning(true);
    const { data, error } = await supabase
      .from("trips")
      .update({ status: "lead" })
      .eq("status", "planning")
      .select("id");
    setRunning(false);
    if (error) {
      toast.error(`Backfill failed: ${error.message}`);
      return;
    }
    toast.success(`Updated ${data?.length ?? 0} trip(s) from "planning" to "lead"`);
    refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-4 w-4" />
          Backfill AI-created trips
        </CardTitle>
        <CardDescription>
          Migrate trips stuck in <code className="text-xs">"planning"</code> to <code className="text-xs">"lead"</code> so they appear in the Trips kanban.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          {count === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : count === 0 ? (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="h-4 w-4" /> No trips to migrate
            </span>
          ) : (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              {count} trip{count === 1 ? "" : "s"} pending
            </Badge>
          )}
        </div>
        <Button onClick={handleBackfill} disabled={running || !count}>
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
          {running ? "Migrating…" : "Run backfill"}
        </Button>
      </CardContent>
    </Card>
  );
}