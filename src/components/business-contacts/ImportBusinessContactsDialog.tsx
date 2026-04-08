import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessContactInsert } from "@/hooks/useBusinessContacts";
import { toast } from "sonner";

interface Props {
  onImport: (contacts: Partial<BusinessContactInsert>[]) => void;
  isPending: boolean;
}

const EXPECTED_HEADERS = [
  "company_name", "contact_name", "email", "phone", "job_title",
  "industry", "website", "linkedin_url", "revenue_size", "employee_count",
  "lead_source", "lead_status", "notes",
];

const HEADER_MAP: Record<string, string> = {
  company: "company_name",
  company_name: "company_name",
  contact: "contact_name",
  contact_name: "contact_name",
  name: "contact_name",
  title: "job_title",
  job_title: "job_title",
  status: "lead_status",
  lead_status: "lead_status",
  source: "lead_source",
  lead_source: "lead_source",
  email: "email",
  phone: "phone",
  industry: "industry",
  website: "website",
  linkedin: "linkedin_url",
  linkedin_url: "linkedin_url",
  revenue: "revenue_size",
  revenue_size: "revenue_size",
  employees: "employee_count",
  employee_count: "employee_count",
  notes: "notes",
};

function parseCSV(text: string): Partial<BusinessContactInsert>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const rawHeaders = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const mappedHeaders = rawHeaders.map((h) => HEADER_MAP[h] || null);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    mappedHeaders.forEach((mapped, i) => {
      if (mapped && values[i]) row[mapped] = values[i];
    });
    return row as Partial<BusinessContactInsert>;
  });
}

export function ImportBusinessContactsDialog({ onImport, isPending }: Props) {
  const [open, setOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [preview, setPreview] = useState<Partial<BusinessContactInsert>[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      toast.error("Please export your Excel file as CSV first, then upload the CSV.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (!parsed.length) {
        toast.error("No data rows found");
        return;
      }
      setPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handlePaste = () => {
    const parsed = parseCSV(pasteText);
    if (!parsed.length) {
      toast.error("No valid rows found. Use CSV format with headers.");
      return;
    }
    setPreview(parsed);
  };

  const handleConfirm = () => {
    onImport(preview);
    setOpen(false);
    setPreview([]);
    setPasteText("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Business Contacts</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mb-2">
          CSV headers: {EXPECTED_HEADERS.join(", ")}
        </p>

        {preview.length === 0 ? (
          <Tabs defaultValue="file">
            <TabsList>
              <TabsTrigger value="file"><FileSpreadsheet className="h-4 w-4 mr-1" /> File Upload</TabsTrigger>
              <TabsTrigger value="paste">Paste CSV</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="space-y-3 pt-2">
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              <Button variant="outline" className="w-full h-24 border-dashed" onClick={() => fileRef.current?.click()}>
                <Upload className="h-6 w-6 mr-2" /> Choose CSV File
              </Button>
            </TabsContent>
            <TabsContent value="paste" className="space-y-3 pt-2">
              <Textarea
                rows={8}
                placeholder={"company_name,contact_name,email,phone\nAcme Corp,John Doe,john@acme.com,555-1234"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <Button onClick={handlePaste} disabled={!pasteText.trim()}>Parse</Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">{preview.length} contacts ready to import</p>
            <div className="max-h-60 overflow-auto border rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left">Company</th>
                    <th className="p-2 text-left">Contact</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Industry</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((c, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{c.company_name}</td>
                      <td className="p-2">{c.contact_name}</td>
                      <td className="p-2">{c.email}</td>
                      <td className="p-2">{c.industry}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 20 && <p className="p-2 text-xs text-muted-foreground">...and {preview.length - 20} more</p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleConfirm} disabled={isPending}>
                {isPending ? "Importing..." : `Import ${preview.length} Contacts`}
              </Button>
              <Button variant="outline" onClick={() => setPreview([])}>Back</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
