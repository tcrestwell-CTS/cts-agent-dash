import { useNavigate } from "react-router-dom";
import { Plus, Mail, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCampaigns, useCreateCampaign } from "@/hooks/useCampaigns";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/15 text-info dark:text-info",
  sending: "bg-warning/15 text-warning dark:text-warning",
  sent: "bg-success/15 text-success dark:text-success",
  failed: "bg-destructive/15 text-destructive",
  paused: "bg-muted text-muted-foreground",
};

export default function Campaigns() {
  const navigate = useNavigate();
  const { data: campaigns = [], isLoading } = useCampaigns();
  const create = useCreateCampaign();

  const handleCreate = async () => {
    const c = await create.mutateAsync({ name: "Untitled campaign", subject: "", body_html: "" });
    navigate(`/campaigns/${c.id}`);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6" /> Campaigns
            </h1>
            <p className="text-sm text-muted-foreground">Create and send marketing emails to your audience</p>
          </div>
          <Button onClick={handleCreate} disabled={create.isPending}>
            <Plus className="h-4 w-4 mr-1" /> New Campaign
          </Button>
        </div>

        <Card>
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : campaigns.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No campaigns yet. Click <strong>New Campaign</strong> to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Clicked</TableHead>
                  <TableHead className="text-right">Bounced</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/campaigns/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{c.subject}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[c.status] ?? ""} variant="secondary">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{c.total_sent}</TableCell>
                    <TableCell className="text-right">{c.total_opened}</TableCell>
                    <TableCell className="text-right">{c.total_clicked}</TableCell>
                    <TableCell className="text-right">{c.total_bounced}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.sent_at ? format(new Date(c.sent_at), "MMM d, yyyy") : format(new Date(c.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}