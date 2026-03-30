// AgentHealthPanel.tsx
// Drop into cts-agent-dash — place on the Health or Dashboard page
// Calls /functions/v1/health-check, displays live agent status
// Styled to match portal's existing navy/gold design system

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Agent metadata for display
const AGENT_META: Record<string, { role: string; trigger: string; color: string }> = {
  tiara:                 { role: 'Lead Qualification',    trigger: 'Form submit',      color: '#a78bfa' },
  richard:               { role: 'Follow-up Sequence',    trigger: 'Qualified lead',   color: '#60a5fa' },
  terrance:              { role: 'Proposal Draft',        trigger: 'Qualified → n8n',  color: '#34d399' },
  chris:                 { role: 'Pre-trip Nurture',      trigger: 'Status: booked',   color: '#f97316' },
  kandi:                 { role: 'Reconciliation',        trigger: 'DB changes + cron',color: '#fbbf24' },
  'google-ads-conversion': { role: 'Ads Conversion',     trigger: 'Qualified/Booked', color: '#f472b6' },
  'portal-leads':        { role: 'DB Connectivity',       trigger: 'Health check',     color: '#94a3b8' },
};

interface AgentResult {
  agent: string;
  slug: string;
  status: 'ok' | 'fail';
  http_code: number;
  latency_ms: number;
  response: string;
}

interface HealthData {
  ok: boolean;
  checked_at: string;
  total: number;
  healthy: number;
  failed: number;
  all_ok: boolean;
  email_sent: boolean;
  results: AgentResult[];
}

function LatencyBar({ ms }: { ms: number }) {
  const pct = Math.min(100, (ms / 600) * 100);
  const color = ms < 200 ? '#22c55e' : ms < 400 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748b', minWidth: 36, textAlign: 'right' }}>{ms}ms</span>
    </div>
  );
}

function StatusDot({ status, pulse }: { status: 'ok' | 'fail' | 'loading'; pulse?: boolean }) {
  const color = status === 'ok' ? '#22c55e' : status === 'fail' ? '#ef4444' : '#f59e0b';
  return (
    <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      {pulse && status === 'ok' && (
        <div style={{
          position: 'absolute', inset: -3, borderRadius: '50%',
          border: `2px solid ${color}`, opacity: 0.4,
          animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
        }} />
      )}
    </div>
  );
}

export default function AgentHealthPanel() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const runCheck = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/health-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ force_email: false }),
      });
      if (res.ok) {
        const result: HealthData = await res.json();
        setData(result);
        setLastRun(new Date());
      }
    } catch (e) {
      console.error('Health check error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { runCheck(); }, [runCheck]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => runCheck(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, runCheck]);

  const allOk = data?.all_ok ?? true;
  const healthPct = data ? Math.round((data.healthy / data.total) * 100) : 100;

  return (
    <>
      <style>{`
        @keyframes ping { 75%,100% { transform: scale(1.8); opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        .health-row { transition: background 0.15s; }
        .health-row:hover { background: rgba(255,255,255,0.04) !important; }
        .health-row.expanded { background: rgba(255,255,255,0.03) !important; }
        .run-btn:hover { background: rgba(201,168,76,0.15) !important; border-color: #c9a84c !important; }
        .run-btn:active { transform: scale(0.97); }
        .toggle-btn:hover { background: rgba(255,255,255,0.06) !important; }
      `}</style>

      <div style={{
        background: '#0f1c2e',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
        animation: 'fadeIn 0.3s ease',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Health ring */}
            <div style={{ position: 'relative', width: 44, height: 44 }}>
              <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.5" />
                <circle cx="22" cy="22" r="18" fill="none"
                  stroke={allOk ? '#22c55e' : '#ef4444'}
                  strokeWidth="3.5"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 * (1 - healthPct / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s' }}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 600, color: allOk ? '#22c55e' : '#ef4444',
                fontFamily: 'monospace',
              }}>
                {loading ? '…' : `${healthPct}%`}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, color: '#f1f5f9', fontFamily: 'Georgia, serif' }}>
                  Agent Health
                </h3>
                {data && (
                  <span style={{
                    padding: '2px 8px',
                    background: allOk ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${allOk ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: allOk ? '#22c55e' : '#ef4444',
                    fontFamily: 'sans-serif', fontSize: '0.65rem', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase' as const, borderRadius: 4,
                  }}>
                    {allOk ? 'All Systems Go' : `${data.failed} Down`}
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#475569', fontFamily: 'sans-serif' }}>
                {data
                  ? `${data.healthy}/${data.total} agents healthy · checked ${lastRun ? formatRelative(lastRun) : '—'}`
                  : 'Loading…'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Auto-refresh toggle */}
            <button
              className="toggle-btn"
              onClick={() => setAutoRefresh(v => !v)}
              style={{
                background: autoRefresh ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${autoRefresh ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
                color: autoRefresh ? '#22c55e' : '#64748b',
                padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'sans-serif', fontSize: '0.72rem', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{ fontSize: '0.65rem' }}>↻</span>
              Auto {autoRefresh ? 'on' : 'off'}
            </button>

            {/* Run button */}
            <button
              className="run-btn"
              onClick={() => runCheck()}
              disabled={loading}
              style={{
                background: 'rgba(201,168,76,0.08)',
                border: '1px solid rgba(201,168,76,0.25)',
                color: '#c9a84c',
                padding: '6px 16px', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'sans-serif', fontSize: '0.78rem', fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: loading ? 0.6 : 1, transition: 'all 0.15s',
              }}
            >
              {loading && (
                <span style={{ width: 10, height: 10, border: '1.5px solid #c9a84c', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              )}
              Run Check
            </button>
          </div>
        </div>

        {/* Agent rows */}
        <div>
          {data ? data.results.map((agent, i) => {
            const meta = AGENT_META[agent.slug];
            const isExpanded = expanded === agent.slug;
            return (
              <div key={agent.slug}>
                <div
                  className={`health-row${isExpanded ? ' expanded' : ''}`}
                  onClick={() => setExpanded(isExpanded ? null : agent.slug)}
                  style={{
                    padding: '14px 24px',
                    borderBottom: i < data.results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr 1fr 140px',
                    alignItems: 'center', gap: 16,
                    cursor: 'pointer',
                    background: agent.status === 'fail' ? 'rgba(239,68,68,0.04)' : 'transparent',
                  }}
                >
                  {/* Status dot */}
                  <StatusDot status={agent.status} pulse={agent.status === 'ok' && i === 0} />

                  {/* Agent name + role */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {meta && (
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', background: meta.color,
                          display: 'inline-block', flexShrink: 0,
                        }} />
                      )}
                      <span style={{ fontFamily: 'Georgia, serif', fontSize: '0.88rem', color: '#e2e8f0', fontWeight: 400 }}>
                        {agent.agent}
                      </span>
                    </div>
                    {meta && (
                      <span style={{ fontFamily: 'sans-serif', fontSize: '0.7rem', color: '#475569', marginLeft: 14 }}>
                        {meta.role}
                      </span>
                    )}
                  </div>

                  {/* Trigger */}
                  <span style={{ fontFamily: 'sans-serif', fontSize: '0.72rem', color: '#475569' }}>
                    {meta?.trigger ?? '—'}
                  </span>

                  {/* Latency bar */}
                  <LatencyBar ms={agent.latency_ms} />
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{
                    padding: '12px 24px 16px 64px',
                    borderBottom: i < data.results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: 'rgba(255,255,255,0.02)',
                    animation: 'fadeIn 0.15s ease',
                  }}>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#475569', fontFamily: 'sans-serif', marginBottom: 3 }}>HTTP Code</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: agent.http_code < 500 ? '#94a3b8' : '#ef4444' }}>{agent.http_code}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#475569', fontFamily: 'sans-serif', marginBottom: 3 }}>Response</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#94a3b8' }}>{agent.response}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#475569', fontFamily: 'sans-serif', marginBottom: 3 }}>Latency</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: agent.latency_ms < 300 ? '#22c55e' : '#f59e0b' }}>{agent.latency_ms}ms</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#475569', fontFamily: 'sans-serif', marginBottom: 3 }}>Function</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#64748b' }}>{agent.slug}</div>
                      </div>
                    </div>
                    {agent.status === 'fail' && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4 }}>
                        <span style={{ fontFamily: 'sans-serif', fontSize: '0.75rem', color: '#fca5a5' }}>
                          ⚠ Agent returned an unexpected response. Check Supabase edge function logs for details.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }) : (
            // Loading skeleton
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{
                padding: '14px 24px', borderBottom: i < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                display: 'grid', gridTemplateColumns: '24px 1fr 1fr 140px', gap: 16, alignItems: 'center',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: `${50 + i * 7}%` }} />
                <div style={{ height: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 4, width: '60%' }} />
                <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2 }} />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {data && (
          <div style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.2)',
          }}>
            <span style={{ fontFamily: 'sans-serif', fontSize: '0.7rem', color: '#334155' }}>
              {autoRefresh ? 'Auto-refreshes every 5 minutes · ' : ''}
              Email alerts fire when any agent fails
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#334155' }}>
              {new Date(data.checked_at).toLocaleString('en-US', {
                timeZone: 'America/New_York',
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })} ET
            </span>
          </div>
        )}
      </div>
    </>
  );
}

function formatRelative(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
