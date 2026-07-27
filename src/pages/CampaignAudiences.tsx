import { useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCampaignAudiences, type CampaignAudience } from "@/hooks/useCampaignAudiences";
import { AudienceDialog } from "@/components/campaigns/AudienceDialog";

export default function CampaignAudiences() {
  const { data, isLoading, save, remove } = useCampaignAudiences();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignAudience | null>(null);
  const [deleting, setDeleting] = useState<CampaignAudience | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (a: CampaignAudience) => {
    setEditing(a);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
              Crestwell Travel Services
            </p>
            <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Audiences</h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Define recipient groups you can target with campaigns.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> New Audience
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : !data?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No audiences yet. Create one to start sending campaigns.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((a) => (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <Badge variant="secondary" className="capitalize">
                      {a.filter?.type?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {a.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {a.contact_count != null
                      ? `${a.contact_count.toLocaleString()} contacts`
                      : "Not yet counted"}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(a)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AudienceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        audience={editing}
        isSaving={save.isPending}
        onSave={async (a) => {
          await save.mutateAsync(a);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete audience?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" will be removed. Campaigns already using it keep their recipient
              snapshot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleting) await remove.mutateAsync(deleting.id);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
