import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, ImageIcon, Library, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useLibraryTemplates,
  type LibraryTemplate,
  type LibraryTemplateKind,
} from "@/hooks/useLibraryTemplates";
import { useImageAssets } from "@/hooks/useImageAssets";

type Draft = {
  id?: string;
  kind: LibraryTemplateKind;
  name: string;
  description: string;
  destination: string;
  trip_type: string;
  duration_days: string;
  content: string;
  tags: string;
  is_shared: boolean;
};

const emptyDraft = (kind: LibraryTemplateKind): Draft => ({
  kind,
  name: "",
  description: "",
  destination: "",
  trip_type: "",
  duration_days: "",
  content: "",
  tags: "",
  is_shared: true,
});

function toDraft(t: LibraryTemplate): Draft {
  return {
    id: t.id,
    kind: t.kind,
    name: t.name,
    description: t.description ?? "",
    destination: t.destination ?? "",
    trip_type: t.trip_type ?? "",
    duration_days: t.duration_days != null ? String(t.duration_days) : "",
    content: t.content ?? "",
    tags: (t.tags ?? []).join(", "),
    is_shared: t.is_shared,
  };
}

function TemplateSection({ kind, title, description }: { kind: LibraryTemplateKind; title: string; description: string }) {
  const { user } = useAuth();
  const { data: templates = [], isLoading, create, update, remove, markUsed } = useLibraryTemplates(kind);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) =>
      [t.name, t.description, t.destination, t.trip_type, ...(t.tags ?? [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [templates, search]);

  const canEdit = (t: LibraryTemplate) => t.created_by === user?.id;

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Give the template a name");
      return;
    }
    const payload = {
      kind: draft.kind,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      destination: draft.destination.trim() || null,
      trip_type: draft.trip_type.trim() || null,
      duration_days: draft.duration_days ? Number(draft.duration_days) : null,
      content: draft.content.trim() || null,
      tags: draft.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      is_shared: draft.is_shared,
    };
    if (draft.id) {
      update.mutate({ id: draft.id, ...payload }, { onSuccess: () => setDraft(null) });
    } else {
      create.mutate(payload, { onSuccess: () => setDraft(null) });
    }
  };

  const copyContent = async (t: LibraryTemplate) => {
    if (!t.content) {
      toast.error("This template has no body content to copy");
      return;
    }
    await navigator.clipboard.writeText(t.content);
    markUsed.mutate(t);
    toast.success("Template copied to clipboard");
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-56"
          />
          <Button onClick={() => setDraft(emptyDraft(kind))}>
            <Plus className="mr-2 h-4 w-4" />
            New template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {templates.length === 0
              ? "No templates in the shared library yet. Create the first one."
              : "No templates match your search."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((t) => (
              <div key={t.id} className="flex flex-col rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.name}</p>
                    {t.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                    )}
                  </div>
                  {t.is_shared ? (
                    <Badge variant="secondary" className="shrink-0 gap-1">
                      <Users className="h-3 w-3" /> Shared
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">
                      Private
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {t.destination && <Badge variant="outline">{t.destination}</Badge>}
                  {t.trip_type && <Badge variant="outline">{t.trip_type}</Badge>}
                  {t.duration_days != null && <Badge variant="outline">{t.duration_days} days</Badge>}
                  {(t.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button size="sm" variant="secondary" onClick={() => copyContent(t)}>
                    <Copy className="mr-2 h-3.5 w-3.5" /> Copy
                  </Button>
                  {canEdit(t) && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setDraft(toDraft(t))}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove.mutate(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">Used {t.usage_count}×</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>
              Shared templates are visible to the whole agency. Only you (or an admin) can edit yours.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Destination</Label>
                  <Input
                    value={draft.destination}
                    onChange={(e) => setDraft({ ...draft, destination: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Trip type</Label>
                  <Input
                    value={draft.trip_type}
                    onChange={(e) => setDraft({ ...draft, trip_type: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Duration (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={draft.duration_days}
                    onChange={(e) => setDraft({ ...draft, duration_days: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Body</Label>
                <Textarea
                  rows={10}
                  placeholder="Day-by-day outline, proposal copy, or email body…"
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Tags (comma separated)</Label>
                <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Share with the agency</p>
                  <p className="text-xs text-muted-foreground">Turn off to keep this template private to you.</p>
                </div>
                <Switch
                  checked={draft.is_shared}
                  onCheckedChange={(v) => setDraft({ ...draft, is_shared: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SharedPhotos() {
  const { user } = useAuth();
  const { data: assets = [], isLoading, upload, remove, setShared } = useImageAssets();
  const [onlyShared, setOnlyShared] = useState(true);

  const visible = onlyShared ? assets.filter((a) => a.is_shared) : assets;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Shared photo library</CardTitle>
          <CardDescription>Agency-wide imagery for itineraries, proposals and campaigns.</CardDescription>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="only-shared" checked={onlyShared} onCheckedChange={setOnlyShared} />
            <Label htmlFor="only-shared" className="text-sm">
              Shared only
            </Label>
          </div>
          <Button asChild variant="secondary">
            <label className="cursor-pointer">
              <ImageIcon className="mr-2 h-4 w-4" />
              Upload
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) upload.mutate(files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No {onlyShared ? "shared " : ""}images yet. Upload one and toggle "Shared" to publish it to the team.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
            {visible.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-lg border bg-card">
                <img
                  src={a.public_url}
                  alt={a.alt_text || a.filename}
                  loading="lazy"
                  className="h-32 w-full object-cover"
                />
                <div className="space-y-2 p-2">
                  <p className="truncate text-xs text-muted-foreground">{a.filename}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={!!a.is_shared}
                        disabled={a.user_id !== user?.id}
                        onCheckedChange={(v) => setShared.mutate({ id: a.id, is_shared: v })}
                      />
                      <span className="text-xs">Shared</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={async () => {
                          await navigator.clipboard.writeText(a.public_url);
                          toast.success("Image URL copied");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {a.user_id === user?.id && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => remove.mutate(a)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TemplateLibrary() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Library className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Template Library</h1>
            <p className="text-sm text-muted-foreground">
              Agency-wide itinerary, proposal and email templates plus a shared photo library.
            </p>
          </div>
        </div>

        <Tabs defaultValue="itinerary">
          <TabsList>
            <TabsTrigger value="itinerary">Itineraries</TabsTrigger>
            <TabsTrigger value="proposal">Proposals</TabsTrigger>
            <TabsTrigger value="email">Emails</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
          </TabsList>
          <TabsContent value="itinerary" className="mt-4">
            <TemplateSection
              kind="itinerary"
              title="Itinerary templates"
              description="Reusable day-by-day outlines organized by destination and trip type."
            />
          </TabsContent>
          <TabsContent value="proposal" className="mt-4">
            <TemplateSection
              kind="proposal"
              title="Proposal templates"
              description="Proven proposal copy your team can reuse and personalize."
            />
          </TabsContent>
          <TabsContent value="email" className="mt-4">
            <TemplateSection
              kind="email"
              title="Email templates"
              description="Client-facing email copy for follow-ups, reminders and welcomes."
            />
          </TabsContent>
          <TabsContent value="photos" className="mt-4">
            <SharedPhotos />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}