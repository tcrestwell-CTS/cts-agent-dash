import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CampaignAudience, AudienceFilter } from "@/hooks/useCampaignAudiences";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  audience?: CampaignAudience | null;
  onSave: (a: { id?: string; name: string; description?: string; filter: AudienceFilter }) => Promise<void> | void;
  isSaving?: boolean;
}

export function AudienceDialog({ open, onOpenChange, audience, onSave, isSaving }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AudienceFilter["type"]>("all_contacts");
  const [emails, setEmails] = useState("");

  useEffect(() => {
    if (open) {
      setName(audience?.name ?? "");
      setDescription(audience?.description ?? "");
      setType((audience?.filter?.type as AudienceFilter["type"]) ?? "all_contacts");
      setEmails((audience?.filter?.emails ?? []).join("\n"));
    }
  }, [open, audience]);

  const handleSave = async () => {
    const filter: AudienceFilter = type === "manual"
      ? { type, emails: emails.split(/\s|,/).map((e) => e.trim()).filter((e) => e.includes("@")) }
      : { type };
    await onSave({
      id: audience?.id,
      name: name.trim() || "Untitled audience",
      description: description.trim(),
      filter,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{audience ? "Edit audience" : "New audience"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Source</Label>
            <Select value={type} onValueChange={(v) => setType(v as AudienceFilter["type"])}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_contacts">All contacts (clients + leads)</SelectItem>
                <SelectItem value="all_clients">All clients</SelectItem>
                <SelectItem value="all_leads">All leads</SelectItem>
                <SelectItem value="manual">Manual email list</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "manual" && (
            <div>
              <Label>Emails (one per line or comma-separated)</Label>
              <Textarea
                rows={5}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                className="mt-1 font-mono text-xs"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}