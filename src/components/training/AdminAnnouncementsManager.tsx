import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Pin, Megaphone } from "lucide-react";
import { useAllAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from "@/hooks/useTrainingAnnouncements";
import { toast } from "sonner";

export function AdminAnnouncementsManager() {
  const { data: announcements } = useAllAnnouncements();
  const createAnnouncement = useCreateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    status: "published",
    is_pinned: false,
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    audience: "all",
  });

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    await createAnnouncement.mutateAsync({
      title: form.title,
      body: form.body || undefined,
      status: form.status,
      is_pinned: form.is_pinned,
      start_date: form.start_date,
      end_date: form.end_date || undefined,
      audience: form.audience,
    });
    toast.success("Announcement created");
    setShowCreate(false);
    setForm({ title: "", body: "", status: "published", is_pinned: false, start_date: new Date().toISOString().split("T")[0], end_date: "", audience: "all" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    await deleteAnnouncement.mutateAsync(id);
    toast.success("Deleted");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Announcements</h2>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" /> New Announcement</Button>
      </div>

      {(announcements || []).map(ann => (
        <div key={ann.id} className="flex items-start justify-between p-4 bg-card rounded-xl border border-border/50">
          <div className="flex items-start gap-3">
            <Megaphone className="h-5 w-5 text-accent mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-card-foreground">{ann.title}</p>
                {ann.is_pinned && <Pin className="h-3 w-3 text-accent" />}
              </div>
              {ann.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ann.body}</p>}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={ann.status === "published" ? "default" : "secondary"} className="text-[10px]">{ann.status}</Badge>
                <span className="text-[10px] text-muted-foreground">{ann.audience} • {ann.start_date}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(ann.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Announcement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Body</Label><Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>End Date (optional)</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Audience</Label>
                <Select value={form.audience} onValueChange={v => setForm(f => ({ ...f, audience: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="agents">Agents</SelectItem>
                    <SelectItem value="admins">Admins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_pinned} onCheckedChange={v => setForm(f => ({ ...f, is_pinned: v }))} />
              <Label>Pin to top</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createAnnouncement.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
