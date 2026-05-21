import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, CheckCircle2, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TripDocUploadsProps {
  tripId: string;
}

export function TripDocUploads({ tripId }: TripDocUploadsProps) {
  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ["doc-uploads", tripId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("client_document_uploads")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tripId,
    staleTime: 1000 * 60 * 2,
  });

  if (isLoading || uploads.length === 0) return null;

  const unreviewed = uploads.filter((u: any) => !u.reviewed).length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Client Documents</span>
          {unreviewed > 0 && (
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
              {unreviewed} new
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {uploads.map((doc: any) => (
          <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground capitalize">
                {doc.doc_key.replace(/_/g, " ")}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {doc.file_name} · {format(new Date(doc.created_at), "MMM d")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {doc.reviewed
                ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3 w-3" />Reviewed</span>
                : <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Clock className="h-3 w-3" />New</span>
              }
              <a
                href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/client-documents/${doc.storage_path}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Eye className="h-3 w-3" />View
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
