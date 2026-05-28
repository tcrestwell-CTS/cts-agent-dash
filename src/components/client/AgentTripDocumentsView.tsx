import { usePortalAgentDocs } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, FolderOpen } from "lucide-react";
import { format } from "date-fns";

interface Props {
  tripId: string;
}

export function AgentTripDocumentsView({ tripId }: Props) {
  const { data, isLoading } = usePortalAgentDocs(tripId);
  const docs = data?.docs || [];

  if (isLoading || docs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          Travel Documents from Your Agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {docs.map((d: any) => (
          <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
            <FileText className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{d.label || d.file_name}</p>
              {d.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                {d.file_name} · Shared {format(new Date(d.created_at), "MMM d, yyyy")}
              </p>
            </div>
            {d.url && (
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                download={d.file_name}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0 self-center"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}