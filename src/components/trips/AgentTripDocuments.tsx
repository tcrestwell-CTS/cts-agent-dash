import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Loader2, Trash2, Eye, FolderUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  tripId: string;
}

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";
const MAX_MB = 20;

export function AgentTripDocuments({ tripId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["trip-agent-docs", tripId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_document_uploads")
        .select("id, label, description, file_name, file_size, mime_type, storage_path, created_at, uploaded_by")
        .eq("trip_id", tripId)
        .not("uploaded_by", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tripId,
  });

  async function handleFile(file: File) {
    if (!user) {
      toast.error("You must be signed in to upload");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File must be under ${MAX_MB}MB`);
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `agent-docs/${user.id}/${tripId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("client-documents")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;

      const { error: insErr } = await (supabase as any)
        .from("client_document_uploads")
        .insert({
          trip_id: tripId,
          uploaded_by: user.id,
          doc_key: "agent_upload",
          label: label.trim() || file.name,
          description: description.trim() || null,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          storage_path: path,
        });
      if (insErr) throw insErr;

      setLabel("");
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Document uploaded — visible to client");
      qc.invalidateQueries({ queryKey: ["trip-agent-docs", tripId] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: any) {
    if (!confirm(`Remove "${doc.label || doc.file_name}"? The client will no longer see this document.`)) return;
    try {
      await supabase.storage.from("client-documents").remove([doc.storage_path]);
      const { error } = await (supabase as any)
        .from("client_document_uploads")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
      toast.success("Document removed");
      qc.invalidateQueries({ queryKey: ["trip-agent-docs", tripId] });
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error("Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderUp className="h-4 w-4 text-primary" />
          Travel Documents for Client
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Upload itineraries, vouchers, or other documents your client can view and download from their portal.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="Label (e.g. Final Itinerary, Hotel Voucher)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={uploading}
          />
          <Textarea
            placeholder="Optional note shown to client"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={uploading}
            rows={2}
          />
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full"
            variant="outline"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />Choose file to upload (max {MAX_MB}MB)</>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : docs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              No documents uploaded yet.
            </p>
          ) : (
            docs.map((d: any) => (
              <div key={d.id} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-muted/30">
                <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{d.label || d.file_name}</p>
                  {d.description && (
                    <p className="text-xs text-muted-foreground truncate">{d.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {d.file_name} · {format(new Date(d.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDoc(d.storage_path)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(d)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}