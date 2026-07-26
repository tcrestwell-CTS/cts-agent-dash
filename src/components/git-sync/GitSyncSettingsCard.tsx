import { useState, useEffect } from "react";
import { Github, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useGitSyncStatus } from "@/hooks/useGitSyncStatus";

export function GitSyncSettingsCard() {
  const { data: status, refetch } = useGitSyncStatus();
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("app_config")
          .select("key, value")
          .eq("scope", "git_sync")
          .in("key", ["github_repo_url", "github_token"]);
        if (error) throw error;
        setRepoUrl(data?.find((c) => c.key === "github_repo_url")?.value || "");
        setToken(data?.find((c) => c.key === "github_token")?.value || "");
      } catch (err: any) {
        toast.error(err?.message || "Failed to load Git sync settings");
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const upsert = async (key: string, value: string) => {
        const { error } = await supabase
          .from("app_config")
          .upsert({ scope: "git_sync", key, value }, { onConflict: "scope,key" });
        if (error) throw error;
      };

      await upsert("github_repo_url", repoUrl.trim());
      await upsert("github_token", token.trim());

      toast.success("Git sync settings saved");
      await refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save Git sync settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5 text-foreground" />
          <CardTitle>GitHub Sync</CardTitle>
        </div>
        <CardDescription>
          Configure the GitHub repository that Lovable syncs with so the header indicator can compare commits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading configuration...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="githubRepoUrl">GitHub repository URL</Label>
              <Input
                id="githubRepoUrl"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
              />
              <p className="text-xs text-muted-foreground">
                Paste the same repository URL you used for Lovable Git sync.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="githubToken">GitHub personal access token (optional)</Label>
              <Input
                id="githubToken"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
              />
              <p className="text-xs text-muted-foreground">
                Only needed for private repositories. Create a token with read-only repo access.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save GitHub Sync Settings
            </Button>

            {status && !loading && (
              <div className="mt-4 rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center gap-2">
                  {status.state === "synced" ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-warning" />
                  )}
                  <span className="font-medium text-foreground">Current status: {status.label}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{status.message}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Lovable:</span>{" "}
                    <span className="font-mono text-foreground">{status.shortSha}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">GitHub:</span>{" "}
                    <span className="font-mono text-foreground">{status.githubShortSha || "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
