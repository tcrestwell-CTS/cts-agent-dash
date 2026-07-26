import { useState } from "react";
import { GitBranch, GitCommit, GitPullRequest, AlertTriangle, CheckCircle2, CircleDashed, ExternalLink, RefreshCw } from "lucide-react";
import { useGitSyncStatus, type GitSyncState } from "@/hooks/useGitSyncStatus";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const statusConfig: Record<GitSyncState, { color: string; icon: React.ElementType; dot: string }> = {
  not_configured: {
    color: "bg-muted text-muted-foreground",
    icon: CircleDashed,
    dot: "bg-muted-foreground",
  },
  synced: {
    color: "bg-success/10 text-success border-success/20",
    icon: CheckCircle2,
    dot: "bg-success",
  },
  ahead: {
    color: "bg-warning/10 text-warning border-warning/20",
    icon: GitCommit,
    dot: "bg-warning",
  },
  behind: {
    color: "bg-info/10 text-info border-info/20",
    icon: GitPullRequest,
    dot: "bg-info",
  },
  diverged: {
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: AlertTriangle,
    dot: "bg-destructive",
  },
  dirty: {
    color: "bg-warning/10 text-warning border-warning/20",
    icon: GitBranch,
    dot: "bg-warning",
  },
  error: {
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: AlertTriangle,
    dot: "bg-destructive",
  },
};

function formatDate(iso: string) {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function GitSyncStatus() {
  const { data, isLoading, refetch } = useGitSyncStatus();
  const [open, setOpen] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="hidden sm:flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>Git sync</span>
      </div>
    );
  }

  const config = statusConfig[data.state];
  const Icon = config.icon;
  const repoUrl = data.githubRepoUrl || data.originUrl;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              refetch();
              setOpen(true);
            }}
            className={cn(
              "hidden sm:inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
              config.color
            )}
            aria-label={`Git sync status: ${data.label}`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{data.label}</span>
            <span className={cn("ml-0.5 h-1.5 w-1.5 rounded-full", config.dot)} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="max-w-xs p-0"
        >
          <div className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", data.state === "synced" ? "text-success" : "text-warning")} />
              <p className="font-semibold text-foreground">{data.label}</p>
            </div>
            <p className="text-sm text-muted-foreground">{data.message}</p>

            <div className="space-y-1 border-t border-border pt-2 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Lovable commit</span>
                <span className="font-mono text-foreground">{data.shortSha}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">GitHub commit</span>
                <span className="font-mono text-foreground">{data.githubShortSha || "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Branch</span>
                <span className="text-foreground">{data.branch}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Built</span>
                <span className="text-foreground">{formatDate(data.commitDate)}</span>
              </div>
            </div>

            {repoUrl && (
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-accent hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Open repository
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <p className="text-[11px] text-muted-foreground/70">
              Click badge to refresh status.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
