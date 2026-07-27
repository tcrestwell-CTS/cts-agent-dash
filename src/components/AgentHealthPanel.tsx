import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, HeartPulse, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AgentResult = {
  agent: string;
  slug: string;
  role: string;
  status: 'ok' | 'fail';
  http_code: number;
  latency_ms: number;
  response: string;
};

type HealthData = {
  ok: boolean;
  checked_at: string;
  total: number;
  healthy: number;
  failed: number;
  all_ok: boolean;
  results: AgentResult[];
};

export default function AgentHealthPanel() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState('');

  const runCheck = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('health-check', {
        body: {},
      });
      if (fnError) throw fnError;
      setData(result as HealthData);
    } catch (e: any) {
      setError(e.message || 'Health check failed');
    } finally {
      setLoading(false);
    }
  };

  const checkedAt = data?.checked_at
    ? new Date(data.checked_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <h3 className="text-[14.5px] font-semibold text-foreground">AI Agent Health</h3>
          {checkedAt && (
            <p className="mt-1 text-[11.5px] text-muted-foreground">Last checked at {checkedAt}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {data && (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[.13em]",
                data.all_ok
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive"
              )}
            >
              {data.healthy}/{data.total} Healthy
            </span>
          )}
          <Button variant="outline" size="sm" onClick={runCheck} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <Activity className="mr-1 h-3.5 w-3.5" />
                Run Check
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="border-b border-border/60 bg-destructive/10 px-5 py-3 text-[12.5px] text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="px-5 py-12 text-center">
          <HeartPulse className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-[13px] text-muted-foreground">Click Run Check to test all agents</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div>
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[10px_1fr_100px] items-center gap-4 px-5 py-3.5",
                i < 6 && "border-b border-border/40"
              )}
            >
              <div className="h-2.5 w-2.5 rounded-full bg-muted" />
              <div>
                <div className="mb-1.5 h-3 rounded bg-muted" style={{ width: `${50 + i * 7}%` }} />
                <div className="h-2 w-2/5 rounded bg-muted/60" />
              </div>
              <div className="h-2.5 rounded bg-muted/60" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {data && (
        <div>
          {data.results.map((r, i) => (
            <div
              key={r.slug}
              className={cn(
                "grid grid-cols-[10px_1fr_auto] items-center gap-4 px-5 py-3.5",
                i < data.results.length - 1 && "border-b border-border/40",
                r.status === "fail" && "bg-destructive/5"
              )}
            >
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  r.status === "ok" ? "bg-success" : "bg-destructive"
                )}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-medium text-foreground">{r.agent}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[.13em]",
                      r.status === "ok"
                        ? "bg-success/15 text-success"
                        : "bg-destructive/15 text-destructive"
                    )}
                  >
                    {r.status === "ok" ? "OK" : "FAIL"}
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">{r.role}</p>
                {r.status === "fail" && (
                  <p className="mt-1 text-[12px] text-destructive">{r.response}</p>
                )}
              </div>
              <div className="text-right tabular-nums">
                <p className="font-mono text-[12px] text-muted-foreground">{r.latency_ms}ms</p>
                <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground/70">
                  {r.http_code}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer summary */}
      {data && (
        <div
          className={cn(
            "border-t border-border/60 bg-muted/30 px-5 py-3 text-[12.5px]",
            data.all_ok ? "text-success" : "text-warning"
          )}
        >
          {data.all_ok
            ? "All agents operational"
            : `${data.failed} agent${data.failed > 1 ? "s" : ""} need attention`}
        </div>
      )}
    </div>
  );
}
