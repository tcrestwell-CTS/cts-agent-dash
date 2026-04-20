import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
    <div style={{
      background: '#0f1c2e',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      overflow: 'hidden',
      fontFamily: 'sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, color: '#f1f5f9', fontFamily: 'Georgia, serif' }}>
            AI Agent Health
          </h3>
          {checkedAt && (
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#475569' }}>
              Last checked at {checkedAt}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {data && (
            <span style={{
              padding: '4px 10px',
              background: data.all_ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${data.all_ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: data.all_ok ? '#22c55e' : '#ef4444',
              fontSize: '0.7rem', fontWeight: 700, borderRadius: 4,
            }}>
              {data.healthy}/{data.total} Healthy
            </span>
          )}
          <button
            onClick={runCheck}
            disabled={loading}
            style={{
              background: 'rgba(201,168,76,0.08)',
              border: '1px solid rgba(201,168,76,0.25)',
              color: '#c9a84c',
              padding: '6px 16px', borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.78rem', fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 0.7s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="30 70" />
                </svg>
                Checking…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                Run Check
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '12px 24px', background: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontSize: '0.8rem' }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" style={{ margin: '0 auto' }}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Click Run Check to test all agents</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div>
          {[...Array(7)].map((_, i) => (
            <div key={i} style={{
              padding: '14px 24px',
              borderBottom: i < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              display: 'grid', gridTemplateColumns: '10px 1fr 100px', gap: 16, alignItems: 'center',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
              <div>
                <div style={{ height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: `${50 + i * 7}%`, marginBottom: 6 }} />
                <div style={{ height: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 4, width: '40%' }} />
              </div>
              <div style={{ height: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {data && (
        <div>
          {data.results.map((r, i) => (
            <div key={r.slug} style={{
              padding: '14px 24px',
              borderBottom: i < data.results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 16, alignItems: 'center',
              background: r.status === 'fail' ? 'rgba(239,68,68,0.04)' : 'transparent',
            }}>
              {/* Status dot */}
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: r.status === 'ok' ? '#22c55e' : '#ef4444',
              }} />

              {/* Agent info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: '0.88rem', color: '#e2e8f0' }}>
                    {r.agent}
                  </span>
                  <span style={{
                    padding: '1px 6px', borderRadius: 3,
                    fontSize: '0.62rem', fontWeight: 700,
                    background: r.status === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: r.status === 'ok' ? '#22c55e' : '#ef4444',
                  }}>
                    {r.status === 'ok' ? 'OK' : 'FAIL'}
                  </span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#475569' }}>{r.role}</p>
                {r.status === 'fail' && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#fca5a5' }}>{r.response}</p>
                )}
              </div>

              {/* Latency + code */}
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>{r.latency_ms}ms</p>
                <p style={{ margin: '2px 0 0', fontFamily: 'monospace', fontSize: '0.65rem', color: '#475569' }}>{r.http_code}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer summary */}
      {data && (
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)',
          fontSize: '0.75rem',
          color: data.all_ok ? '#22c55e' : '#f59e0b',
        }}>
          {data.all_ok
            ? '✓ All agents operational'
            : `⚠ ${data.failed} agent${data.failed > 1 ? 's' : ''} need attention`
          }
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
