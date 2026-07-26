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

async function getGitHubLatestCommit(
  owner: string,
  repo: string,
  token: string | null,
): Promise<{ sha: string; message: string; date: string } | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Crestwell-Git-Sync-Status",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/HEAD`,
      { headers },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub ${res.status}: ${text}`);
    }
    const data = await res.json();
    return {
      sha: data.sha,
      message: data.commit?.message?.split("\n")[0] || "",
      date: data.commit?.committer?.date || "",
    };
  } catch (err) {
    console.error("GitHub fetch failed:", err);
    return null;
  }
}

async function getOriginCommitFromConfig(config: AppConfig[] | null): Promise<string | null> {
  if (!config) return null;
  const raw = config.find((c) => c.key === "git_origin_commit")?.value;
  return raw || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
      .in("key", ["github_repo_url", "github_token", "git_origin_commit"])
      .eq("scope", "git_sync");

    if (configError) {
      return new Response(
        JSON.stringify({ error: configError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const config = configRows || [];
    const repoUrl = config.find((c) => c.key === "github_repo_url")?.value || "";
    const token = config.find((c) => c.key === "github_token")?.value || null;
    const originCommit = await getOriginCommitFromConfig(config);

    let github: { sha: string; shortSha: string; message: string; date: string } | null = null;
    let githubError: string | null = null;
    const repo = parseGitHubRepo(repoUrl);

    if (repoUrl) {
      if (repo) {
        const gh = await getGitHubLatestCommit(repo.owner, repo.repo, token);
        if (gh) {
          github = {
            sha: gh.sha,
            shortSha: gh.sha.slice(0, 8),
            message: gh.message,
            date: gh.date,
          };
        } else {
          githubError = "Could not reach GitHub. If the repo is private, add a GitHub token in Settings.";
        }
      } else {
        githubError = "GitHub repo URL format is not recognized.";
      }
    }

    return new Response(
      JSON.stringify({
        githubRepoUrl: repoUrl,
        github: github || undefined,
        githubError: githubError || undefined,
        originCommit: originCommit || undefined,
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
