import { useState, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Loader2, CheckCircle2, Upload, X, FileText, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { getPortalAuthHeaders } from "@/lib/portalAuthHeaders";

const DOC_ITEMS = [
  { key: "passport",          label: "Passport valid for travel",        description: "Valid for at least 6 months past your return date", requiresUpload: true },
  { key: "insurance",         label: "Travel insurance obtained",         description: "Coverage for medical, cancellation, and baggage",    requiresUpload: false },
  { key: "visa",              label: "Visa requirements reviewed",        description: "Check entry requirements for all destinations",      requiresUpload: false },
  { key: "emergency_contacts",label: "Emergency contacts provided",       description: "Share emergency contact info with your agent",       requiresUpload: false },
];

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;

interface TravelDocChecklistProps {
  tripId: string;
}

export function TravelDocChecklist({ tripId }: TravelDocChecklistProps) {
  const { session } = usePortalAuth();
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [uploads, setUploads] = useState<Record<string, { name: string; url: string; uploading: boolean }>>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const completed = DOC_ITEMS.filter(i => checklist[i.key]).length;
  const progress = Math.round((completed / DOC_ITEMS.length) * 100);

  async function toggleItem(key: string, checked: boolean) {
    setUpdating(key);
    try {
      const headers = await getPortalAuthHeaders(session);
      // BUG FIX: this was previously calling resource=doc-checklist-update
      // (doesn't exist — portal-data only has "doc-checklist") with body
      // fields {key, checked} instead of the {itemKey, isChecked} the edge
      // function actually reads. Every toggle click updated local UI state
      // optimistically and then silently no-op'd server-side — nothing was
      // ever actually saved. Fixed to match the real resource + payload
      // shape, and now checks response.ok instead of assuming success.
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data?resource=doc-checklist`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ tripId, itemKey: key, isChecked: checked }),
        }
      );
      if (!res.ok) throw new Error(`Checklist update failed (${res.status})`);
      setChecklist(prev => ({ ...prev, [key]: checked }));
    } catch {
      toast.error("Failed to update checklist");
    }
    setUpdating(null);
  }

  async function handleUpload(key: string, file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please upload a PDF or image file"); return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File must be under ${MAX_SIZE_MB}MB`); return;
    }

    setUploads(prev => ({ ...prev, [key]: { name: file.name, url: "", uploading: true } }));

    try {
      const clientId = session?.clientId;
      const ext = file.name.split(".").pop();
      const path = `portal-docs/${clientId}/${tripId}/${key}-${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("client-documents")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("client-documents")
        .getPublicUrl(path);

      setUploads(prev => ({
        ...prev,
        [key]: { name: file.name, url: urlData.publicUrl, uploading: false },
      }));

      // Auto-check the item if it requires upload
      if (!checklist[key]) toggleItem(key, true);
      toast.success("Document uploaded successfully");
    } catch (e) {
      setUploads(prev => ({ ...prev, [key]: { name: "", url: "", uploading: false } }));
      toast.error("Upload failed — please try again");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Travel Document Checklist
          </CardTitle>
          <span className="text-sm font-semibold text-primary">{completed}/{DOC_ITEMS.length}</span>
        </div>
        <Progress value={progress} className="h-1.5 mt-2" />
      </CardHeader>

      <CardContent className="space-y-4">
        {completed === DOC_ITEMS.length && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <p className="text-sm font-medium text-success">All items complete — you're ready to travel!</p>
          </div>
        )}

        {DOC_ITEMS.map((item) => (
          <div key={item.key} className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                checked={!!checklist[item.key]}
                disabled={updating === item.key}
                onCheckedChange={(v) => toggleItem(item.key, !!v)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              {updating === item.key && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-0.5" />}
            </label>

            {/* Upload area for items that require a document */}
            {item.requiresUpload && (
              <div className="ml-7">
                {uploads[item.key]?.url ? (
                  <div className="flex items-center gap-2 text-xs text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate flex-1">{uploads[item.key].name}</span>
                    <a href={uploads[item.key].url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-success hover:underline shrink-0">
                      <Eye className="h-3 w-3" />View
                    </a>
                    <button onClick={() => setUploads(prev => { const n = {...prev}; delete n[item.key]; return n; })}
                      className="text-success hover:text-destructive shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={el => { fileRefs.current[item.key] = el; }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(item.key, f);
                      }}
                    />
                    <button
                      onClick={() => fileRefs.current[item.key]?.click()}
                      disabled={uploads[item.key]?.uploading}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary rounded-lg px-3 py-2 transition-colors w-full"
                    >
                      {uploads[item.key]?.uploading
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading...</>
                        : <><Upload className="h-3.5 w-3.5" />Upload passport scan (PDF or image, max 10MB)</>
                      }
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
