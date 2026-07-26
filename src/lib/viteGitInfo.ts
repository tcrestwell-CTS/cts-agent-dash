import { execSync } from "child_process";

export interface GitBuildInfo {
  commitSha: string;
  shortSha: string;
  branch: string;
  commitDate: string;
  commitMessage: string;
  isDirty: boolean;
  hasGit: boolean;
  originUrl: string;
}

function safeExec(command: string, cwd: string): string | null {
  try {
    return execSync(command, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function getGitBuildInfo(rootDir: string): GitBuildInfo {
  const hasGit = !!safeExec("git rev-parse --git-dir", rootDir);
  const commitSha = safeExec("git rev-parse HEAD", rootDir) || "unknown";
  const shortSha = commitSha === "unknown" ? "unknown" : commitSha.slice(0, 8);
  const branch = safeExec("git rev-parse --abbrev-ref HEAD", rootDir) || "unknown";
  const commitDate = safeExec("git log -1 --format=%cI", rootDir) || "";
  const commitMessage = safeExec("git log -1 --format=%s", rootDir) || "unknown";
  const isDirty = (safeExec("git status --porcelain", rootDir) || "").length > 0;
  const originUrl = safeExec("git remote get-url origin", rootDir) || "";

  return {
    commitSha,
    shortSha,
    branch,
    commitDate,
    commitMessage,
    isDirty,
    hasGit,
    originUrl,
  };
}

export function gitInfoEnvDefines(rootDir: string): Record<string, string> {
  const info = getGitBuildInfo(rootDir);
  return {
    "import.meta.env.VITE_GIT_COMMIT_SHA": JSON.stringify(info.commitSha),
    "import.meta.env.VITE_GIT_SHORT_SHA": JSON.stringify(info.shortSha),
    "import.meta.env.VITE_GIT_BRANCH": JSON.stringify(info.branch),
    "import.meta.env.VITE_GIT_COMMIT_DATE": JSON.stringify(info.commitDate),
    "import.meta.env.VITE_GIT_COMMIT_MESSAGE": JSON.stringify(info.commitMessage),
    "import.meta.env.VITE_GIT_IS_DIRTY": JSON.stringify(info.isDirty ? "true" : "false"),
    "import.meta.env.VITE_GIT_ORIGIN_URL": JSON.stringify(info.originUrl),
  };
}
