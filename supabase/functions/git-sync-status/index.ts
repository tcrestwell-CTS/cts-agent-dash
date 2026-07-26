import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

interface AppConfig {
  key: string;
  value: string;
}

type CompareStatus = "identical" | "ahead" | "behind" | "diverged" | "unknown";

interface GitHubComparison {
  status: CompareStatus;
  aheadBy: number;
  behindBy: number;
  githubSha: string;
  githubMessage: string;
  githubDate: string;
}

function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  try {
    const trimmed = url.trim().replace(/\.git$/, "");
    const match = trimmed.match(/(?:github\.com\/|github\.com:)([^\/]+)\/([^\/]+)$/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

async function compareWithGitHub(
  owner: string,
  repo: string,
  localSha: string,
  token: string | null,
): Promise<GitHubComparison | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Crestwell-Git-Sync-Status",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const compareRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/compare/${localSha}...HEAD`,
      { headers },
    );

    if (!compareRes.ok) {
      const text = await compareRes.text();
      throw new Error(`GitHub compare ${compareRes.status}: ${text}`);
    }

    const compare = await compareRes.json();
    const statusRaw = compare.status as string;
    const status: CompareStatus =
      statusRaw === "identical" ? "identical" :
      statusRaw === "ahead" ? "ahead" :
      statusRaw === "behind" ? "behind" :
      statusRaw === "diverged" ? "diverged" : "unknown";

    return {
      status,
      aheadBy: Number(compare.ahead_by || 0),
      behindBy: Number(compare.behind_by || 0),
      githubSha: compare.commits?.[compare.commits.length - 1]?.sha || "",
      githubMessage: compare.commits?.[compare.commits.length - 1]?.commit?.message?.split("\n")[0] || "",
      githubDate: compare.commits?.[compare.commits.length - 1]?.commit?.committer?.date || "",
    };
  } catch (err) {
    console.error("GitHub compare failed:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let localSha = "";
    if (req.method === "POST") {
      try {
        const body = await req.json();
        localSha = body?.localSha || "";
      } catch {
        localSha = "";
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: configRows, error: configError } = await supabase
      .from("app_config")
      .select("key, value")
      .in("key", ["github_repo_url", "github_token"])
      .eq("scope", "git_sync");

    if (configError) {
      return new Response(
        JSON.stringify({ error: configError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const config = configRows || [];
    const repoUrl = config.find((c: AppConfig) => c.key === "github_repo_url")?.value || "";
    const token = config.find((c: AppConfig) => c.key === "github_token")?.value || null;

    const repo = parseGitHubRepo(repoUrl);
    let comparison: GitHubComparison | null = null;
    let githubError: string | null = null;

    if (repoUrl) {
      if (!repo) {
        githubError = "GitHub repo URL format is not recognized.";
      } else if (!localSha || localSha === "unknown") {
        githubError = "Local commit SHA is not available.";
      } else {
        comparison = await compareWithGitHub(repo.owner, repo.repo, localSha, token);
        if (!comparison) {
          githubError = "Could not reach GitHub. If the repo is private, add a GitHub token in Settings.";
        }
      }
    }

    return new Response(
      JSON.stringify({
        githubRepoUrl: repoUrl,
        comparison: comparison || undefined,
        githubError: githubError || undefined,
        localSha: localSha || undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
