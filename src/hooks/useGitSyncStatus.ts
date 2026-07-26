import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GitSyncState =
  | "not_configured"
  | "synced"
  | "ahead"
  | "behind"
  | "diverged"
  | "dirty"
  | "error";

export interface GitSyncStatus {
  state: GitSyncState;
  label: string;
  message: string;
  localSha: string;
  shortSha: string;
  branch: string;
  commitDate: string;
  commitMessage: string;
  isDirty: boolean;
  hasGit: boolean;
  originUrl: string;
  githubRepoUrl: string | null;
  githubSha: string | null;
  githubShortSha: string | null;
  githubMessage: string | null;
  githubDate: string | null;
  aheadBy: number;
  behindBy: number;
  githubError: string | null;
}

function getLocalGitInfo(): Pick<
  GitSyncStatus,
  "localSha" | "shortSha" | "branch" | "commitDate" | "commitMessage" | "isDirty" | "hasGit" | "originUrl"
> {
  return {
    localSha: import.meta.env.VITE_GIT_COMMIT_SHA || "unknown",
    shortSha: import.meta.env.VITE_GIT_SHORT_SHA || "unknown",
    branch: import.meta.env.VITE_GIT_BRANCH || "unknown",
    commitDate: import.meta.env.VITE_GIT_COMMIT_DATE || "",
    commitMessage: import.meta.env.VITE_GIT_COMMIT_MESSAGE || "unknown",
    isDirty: import.meta.env.VITE_GIT_IS_DIRTY === "true",
    hasGit: !!import.meta.env.VITE_GIT_COMMIT_SHA,
    originUrl: import.meta.env.VITE_GIT_ORIGIN_URL || "",
  };
}

export function useGitSyncStatus() {
  const local = getLocalGitInfo();

  return useQuery({
    queryKey: ["git-sync-status", local.localSha],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("git-sync-status", {
        body: { localSha: local.localSha },
      });


      if (error) {
        throw error;
      }

      const comparison = data?.comparison;
      const repoUrl = data?.githubRepoUrl || null;
      const githubError = data?.githubError || null;

      let state: GitSyncState = "not_configured";
      let label = "Git sync";
      let message = "GitHub sync is not configured.";

      if (local.isDirty) {
        state = "dirty";
        label = "Uncommitted";
        message = "The working tree has uncommitted changes.";
      } else if (repoUrl) {
        if (githubError) {
          state = "error";
          label = "Git error";
          message = githubError;
        } else if (comparison) {
          if (comparison.status === "identical") {
            state = "synced";
            label = "Synced";
            message = "This project is in sync with GitHub.";
          } else if (comparison.status === "ahead") {
            state = "ahead";
            label = "Ahead";
            message = `${comparison.aheadBy} commit(s) in Lovable not yet pushed to GitHub.`;
          } else if (comparison.status === "behind") {
            state = "behind";
            label = "Behind";
            message = `${comparison.behindBy} commit(s) on GitHub not yet in this build.`;
          } else if (comparison.status === "diverged") {
            state = "diverged";
            label = "Diverged";
            message = "This project and GitHub have diverged.";
          } else {
            state = "error";
            label = "Unknown";
            message = "Could not determine sync status.";
          }
        }
      }

      return {
        state,
        label,
        message,
        ...local,
        githubRepoUrl: repoUrl,
        githubSha: comparison?.githubSha || null,
        githubShortSha: comparison?.githubSha ? comparison.githubSha.slice(0, 8) : null,
        githubMessage: comparison?.githubMessage || null,
        githubDate: comparison?.githubDate || null,
        aheadBy: comparison?.aheadBy || 0,
        behindBy: comparison?.behindBy || 0,
        githubError,
      } as GitSyncStatus;
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 5,
  });
}
