import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  FileText,
  GripVertical,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTrainingPhases, useCreatePhase, useUpdatePhase, useDeletePhase } from "@/hooks/useTrainingPhases";
import { useTrainingModulesV2, useCreateModuleV2, useUpdateModuleV2, useDeleteModuleV2 } from "@/hooks/useTrainingModulesV2";
import { useTrainingLessons, useCreateLesson, useUpdateLesson, useDeleteLesson } from "@/hooks/useTrainingLessons";
import { toast } from "sonner";

type EditingType = "phase" | "module" | "lesson";
type EditingItem = {
  type: EditingType;
  id?: string; // undefined = creating new
  parent_id?: string;
  title: string;
  description: string;
  sort_order: number;
  status: string;
  is_required: boolean;
  estimated_minutes: number;
  lesson_type: string;
  content_body: string;
  video_url: string;
  external_url: string;
  unlock_rule: string;
};

const emptyItem = (type: EditingType, parentId?: string): EditingItem => ({
  type,
  parent_id: parentId,
  title: "",
  description: "",
  sort_order: 1,
  status: "published",
  is_required: true,
  estimated_minutes: 15,
  lesson_type: "text",
  content_body: "",
  video_url: "",
  external_url: "",
  unlock_rule: "sequential",
});

export function AdminContentManager() {
  const { data: phases } = useTrainingPhases();
  const { data: modules } = useTrainingModulesV2();
  const { data: lessons } = useTrainingLessons();
  const createPhase = useCreatePhase();
  const updatePhase = useUpdatePhase();
  const deletePhase = useDeletePhase();
  const createModule = useCreateModuleV2();
  const updateModule = useUpdateModuleV2();
  const deleteModule = useDeleteModuleV2();
  const createLesson = useCreateLesson();
  const updateLesson = useUpdateLesson();
  const deleteLesson = useDeleteLesson();

  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<EditingItem | null>(null);

  const handleSave = async () => {
    if (!editing || !editing.title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      if (editing.type === "phase") {
        const payload = {
          title: editing.title,
          description: editing.description || undefined,
          sort_order: editing.sort_order,
          status: editing.status,
          estimated_minutes: editing.estimated_minutes,
        };
        if (editing.id) {
          await updatePhase.mutateAsync({ id: editing.id, ...payload });
          toast.success("Phase updated");
        } else {
          await createPhase.mutateAsync(payload);
          toast.success("Phase created");
        }
      } else if (editing.type === "module") {
        const payload = {
          phase_id: editing.parent_id!,
          title: editing.title,
          description: editing.description || undefined,
          sort_order: editing.sort_order,
          status: editing.status,
          is_required: editing.is_required,
          estimated_minutes: editing.estimated_minutes,
          unlock_rule: editing.unlock_rule,
        };
        if (editing.id) {
          await updateModule.mutateAsync({ id: editing.id, ...payload });
          toast.success("Module updated");
        } else {
          await createModule.mutateAsync(payload);
          toast.success("Module created");
        }
      } else if (editing.type === "lesson") {
        const payload = {
          module_id: editing.parent_id!,
          title: editing.title,
          description: editing.description || undefined,
          sort_order: editing.sort_order,
          status: editing.status,
          is_required: editing.is_required,
          estimated_minutes: editing.estimated_minutes,
          lesson_type: editing.lesson_type,
          content_body: editing.content_body || undefined,
          video_url: editing.video_url || undefined,
          external_url: editing.external_url || undefined,
        };
        if (editing.id) {
          await updateLesson.mutateAsync({ id: editing.id, ...payload });
          toast.success("Lesson updated");
        } else {
          await createLesson.mutateAsync(payload);
          toast.success("Lesson created");
        }
      }
      setEditing(null);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Error saving");
    }
  };

  const handleDelete = async (type: EditingType, id: string) => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    try {
      if (type === "phase") await deletePhase.mutateAsync(id);
      else if (type === "module") await deleteModule.mutateAsync(id);
      else await deleteLesson.mutateAsync(id);
      toast.success("Deleted");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Error deleting");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Content Manager</h2>
        <Button onClick={() => setEditing(emptyItem("phase"))} className="gap-2">
          <Plus className="h-4 w-4" /> Add Phase
        </Button>
      </div>

      {(phases || []).map(phase => {
        const phaseModules = (modules || []).filter(m => m.phase_id === phase.id).sort((a, b) => a.sort_order - b.sort_order);
        const isOpen = openPhases[phase.id] ?? false;

        return (
          <Collapsible key={phase.id} open={isOpen} onOpenChange={() => setOpenPhases(prev => ({ ...prev, [phase.id]: !prev[phase.id] }))}>
            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <CollapsibleTrigger className="flex items-center gap-3 flex-1">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div className="text-left">
                    <p className="font-semibold text-card-foreground">{phase.title}</p>
                    <p className="text-xs text-muted-foreground">{phaseModules.length} modules • {phase.status}</p>
                  </div>
                </CollapsibleTrigger>
                <div className="flex items-center gap-2">
                  <Badge variant={phase.status === "published" ? "default" : "secondary"} className="text-xs">{phase.status}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => setEditing({
                    ...emptyItem("phase"),
                    id: phase.id,
                    title: phase.title,
                    description: phase.description || "",
                    sort_order: phase.sort_order,
                    status: phase.status,
                    estimated_minutes: phase.estimated_minutes || 0,
                  })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete("phase", phase.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <CollapsibleContent>
                <div className="border-t border-border/50 px-4 py-3 space-y-2">
                  {phaseModules.map(mod => {
                    const modLessons = (lessons || []).filter(l => l.module_id === mod.id).sort((a, b) => a.sort_order - b.sort_order);
                    const isModOpen = openModules[mod.id] ?? false;

                    return (
                      <Collapsible key={mod.id} open={isModOpen} onOpenChange={() => setOpenModules(prev => ({ ...prev, [mod.id]: !prev[mod.id] }))}>
                        <div className="bg-muted/30 rounded-lg border border-border/30">
                          <div className="flex items-center justify-between p-3">
                            <CollapsibleTrigger className="flex items-center gap-2 flex-1">
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                              {isModOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              <BookOpen className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium text-card-foreground">{mod.title}</span>
                              <span className="text-xs text-muted-foreground">({modLessons.length} lessons)</span>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-1">
                              {mod.is_required && <Badge variant="secondary" className="text-[10px]">Req</Badge>}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing({
                                ...emptyItem("module", phase.id),
                                id: mod.id,
                                title: mod.title,
                                description: mod.description || "",
                                sort_order: mod.sort_order,
                                status: mod.status,
                                is_required: mod.is_required,
                                estimated_minutes: mod.estimated_minutes || 0,
                                unlock_rule: mod.unlock_rule || "sequential",
                              })}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete("module", mod.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <div className="border-t border-border/30 px-3 py-2 space-y-1">
                              {modLessons.map(lesson => (
                                <div key={lesson.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs text-card-foreground">{lesson.title}</span>
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">{lesson.lesson_type.replace("_", " ")}</Badge>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing({
                                      ...emptyItem("lesson", mod.id),
                                      id: lesson.id,
                                      title: lesson.title,
                                      description: lesson.description || "",
                                      sort_order: lesson.sort_order,
                                      status: lesson.status,
                                      is_required: lesson.is_required,
                                      estimated_minutes: lesson.estimated_minutes || 0,
                                      lesson_type: lesson.lesson_type,
                                      content_body: lesson.content_body || "",
                                      video_url: lesson.video_url || "",
                                      external_url: lesson.external_url || "",
                                    })}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete("lesson", lesson.id)}>
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <Button variant="ghost" size="sm" className="text-xs gap-1 w-full justify-start mt-1" onClick={() => setEditing(emptyItem("lesson", mod.id))}>
                                <Plus className="h-3 w-3" /> Add Lesson
                              </Button>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                  <Button variant="ghost" size="sm" className="text-xs gap-1 w-full justify-start" onClick={() => setEditing(emptyItem("module", phase.id))}>
                    <Plus className="h-3 w-3" /> Add Module
                  </Button>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit" : "Create"} {editing?.type === "phase" ? "Phase" : editing?.type === "module" ? "Module" : "Lesson"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sort Order</Label>
                  <Input type="number" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label>Estimated Minutes</Label>
                  <Input type="number" value={editing.estimated_minutes} onChange={e => setEditing({ ...editing, estimated_minutes: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editing.type !== "phase" && (
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={editing.is_required} onCheckedChange={v => setEditing({ ...editing, is_required: v })} />
                    <Label>Required</Label>
                  </div>
                )}
              </div>

              {editing.type === "module" && (
                <div>
                  <Label>Unlock Rule</Label>
                  <Select value={editing.unlock_rule} onValueChange={v => setEditing({ ...editing, unlock_rule: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequential">Sequential</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="none">None (Always Open)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editing.type === "lesson" && (
                <>
                  <div>
                    <Label>Lesson Type</Label>
                    <Select value={editing.lesson_type} onValueChange={v => setEditing({ ...editing, lesson_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Rich Text</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="external_link">External Link</SelectItem>
                        <SelectItem value="download">Download</SelectItem>
                        <SelectItem value="sop">SOP</SelectItem>
                        <SelectItem value="checklist">Checklist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(editing.lesson_type === "video" || editing.lesson_type === "text") && (
                    <div>
                      <Label>Video URL (embed)</Label>
                      <Input value={editing.video_url} onChange={e => setEditing({ ...editing, video_url: e.target.value })} placeholder="https://youtube.com/embed/..." />
                    </div>
                  )}
                  {editing.lesson_type === "external_link" && (
                    <div>
                      <Label>External URL</Label>
                      <Input value={editing.external_url} onChange={e => setEditing({ ...editing, external_url: e.target.value })} placeholder="https://..." />
                    </div>
                  )}
                  <div>
                    <Label>Content (HTML/Rich Text)</Label>
                    <Textarea value={editing.content_body} onChange={e => setEditing({ ...editing, content_body: e.target.value })} rows={6} placeholder="Write lesson content..." />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createPhase.isPending || updatePhase.isPending || createModule.isPending || updateModule.isPending || createLesson.isPending || updateLesson.isPending}>
              {editing?.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
