import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { BusinessContactInsert } from "@/hooks/useBusinessContacts";

interface Props {
  onAdd: (contact: Partial<BusinessContactInsert>) => void;
  isPending: boolean;
}

const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Real Estate", "Hospitality", "Retail", "Manufacturing", "Education", "Legal", "Other"];
const STATUSES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];

export function AddBusinessContactDialog({ onAdd, isPending }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<BusinessContactInsert>>({ lead_status: "new" });

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name?.trim()) return;
    onAdd(form);
    setOpen(false);
    setForm({ lead_status: "new" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add Contact</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Business Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Company Name *</Label>
              <Input required value={form.company_name || ""} onChange={(e) => update("company_name", e.target.value)} />
            </div>
            <div>
              <Label>Contact Name</Label>
              <Input value={form.contact_name || ""} onChange={(e) => update("contact_name", e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email || ""} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone || ""} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <Label>Job Title</Label>
              <Input value={form.job_title || ""} onChange={(e) => update("job_title", e.target.value)} />
            </div>
            <div>
              <Label>Industry</Label>
              <Select value={form.industry || ""} onValueChange={(v) => update("industry", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.website || ""} onChange={(e) => update("website", e.target.value)} />
            </div>
            <div>
              <Label>LinkedIn</Label>
              <Input value={form.linkedin_url || ""} onChange={(e) => update("linkedin_url", e.target.value)} />
            </div>
            <div>
              <Label>Revenue Size</Label>
              <Input placeholder="e.g. $1M-$10M" value={form.revenue_size || ""} onChange={(e) => update("revenue_size", e.target.value)} />
            </div>
            <div>
              <Label>Employee Count</Label>
              <Input placeholder="e.g. 50-100" value={form.employee_count || ""} onChange={(e) => update("employee_count", e.target.value)} />
            </div>
            <div>
              <Label>Lead Source</Label>
              <Input placeholder="e.g. Referral" value={form.lead_source || ""} onChange={(e) => update("lead_source", e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.lead_status || "new"} onValueChange={(v) => update("lead_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Adding..." : "Add Business Contact"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
