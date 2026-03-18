import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type LoanApplication = {
  id: string;
  created_at: string;
  application_number: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  ssn_last_four: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  housing_status: string;
  years_at_address: string;
  employment_status: string;
  employer_name: string;
  job_title: string;
  years_employed: string;
  monthly_income: number;
  other_income: number;
  other_income_source: string;
  loan_amount_requested: number;
  loan_purpose: string;
  trip_description: string;
  travel_date: string;
  down_payment: number;
  preferred_term_months: number;
  monthly_rent_mortgage: number;
  monthly_car_payment: number;
  monthly_other_debt: number;
  checking_account: boolean;
  savings_account: boolean;
  bankruptcy_history: boolean;
  bankruptcy_details: string;
  reference1_name: string;
  reference1_phone: string;
  reference1_relation: string;
  reference2_name: string;
  reference2_phone: string;
  reference2_relation: string;
  ip_address: string;
  consent_credit_check: boolean;
  consent_terms: boolean;
  esignature: string;
  signed_at: string;
  agent_notes: string;
  assigned_to: string;
  decision_date: string;
  decision_notes: string;
  approved_amount: number;
  approved_rate: number;
  approved_term_months: number;
};

const STATUS_COLORS: Record<string, string> = {
  pending:    '#f59e0b',
  reviewing:  '#3b82f6',
  approved:   '#10b981',
  denied:     '#ef4444',
  more_info:  '#8b5cf6',
};

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pending Review',
  reviewing: 'Under Review',
  approved:  'Approved',
  denied:    'Denied',
  more_info: 'More Info Needed',
};

function fmt$(n: number | null) {
  if (!n) return '—';
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LoanApplicationsManager() {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LoanApplication | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [approvedRate, setApprovedRate] = useState('');
  const [approvedTerm, setApprovedTerm] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');

  const fetchApplications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('loan_applications')
      .select('*')
      .order('created_at', { ascending: false });
    setApplications((data as LoanApplication[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchApplications(); }, []);

  useEffect(() => {
    if (selected) {
      setNotes(selected.agent_notes || '');
      setNewStatus(selected.status);
      setApprovedAmount(selected.approved_amount?.toString() || '');
      setApprovedRate(selected.approved_rate?.toString() || '');
      setApprovedTerm(selected.approved_term_months?.toString() || '');
      setDecisionNotes(selected.decision_notes || '');
    }
  }, [selected]);

  const saveDecision = async () => {
    if (!selected) return;
    setSaving(true);
    const update: Record<string, unknown> = {
      status: newStatus,
      agent_notes: notes,
      decision_notes: decisionNotes,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'approved') {
      update.decision_date = new Date().toISOString();
      update.approved_amount = approvedAmount ? parseFloat(approvedAmount) : null;
      update.approved_rate = approvedRate ? parseFloat(approvedRate) : null;
      update.approved_term_months = approvedTerm ? parseInt(approvedTerm) : null;
    }
    await supabase.from('loan_applications').update(update).eq('id', selected.id);
    await fetchApplications();
    setSelected(prev => prev ? { ...prev, ...update } as LoanApplication : prev);
    setSaving(false);
  };

  const filtered = applications.filter(a => {
    const matchStatus = filter === 'all' || a.status === filter;
    const matchSearch = !search || [a.first_name, a.last_name, a.email, a.application_number, a.phone]
      .join(' ').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    reviewing: applications.filter(a => a.status === 'reviewing').length,
    approved: applications.filter(a => a.status === 'approved').length,
    totalRequested: applications.reduce((s, a) => s + (a.loan_amount_requested || 0), 0),
  };

  if (selected) {
    const dti = selected.monthly_income
      ? (((selected.monthly_rent_mortgage || 0) + (selected.monthly_car_payment || 0) + (selected.monthly_other_debt || 0)) / selected.monthly_income * 100).toFixed(1)
      : null;

    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#1e293b' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <button onClick={() => setSelected(null)} style={{ padding: '6px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>← Back</button>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selected.first_name} {selected.last_name}</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{selected.application_number} · Submitted {fmtDate(selected.created_at)}</p>
          </div>
          <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: (STATUS_COLORS[selected.status] || '#94a3b8') + '20', color: STATUS_COLORS[selected.status] || '#94a3b8', border: `1px solid ${(STATUS_COLORS[selected.status] || '#94a3b8')}40` }}>
            {STATUS_LABELS[selected.status] || selected.status}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
          {/* Left — Application details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Personal */}
            <Section title="Personal Information">
              <Row label="Full Name" value={`${selected.first_name} ${selected.last_name}`} />
              <Row label="Email" value={selected.email} />
              <Row label="Phone" value={selected.phone} />
              <Row label="Date of Birth" value={fmtDate(selected.date_of_birth)} />
              <Row label="SSN (last 4)" value={selected.ssn_last_four || '—'} />
              <Row label="Address" value={`${selected.address_line1}${selected.address_line2 ? ', ' + selected.address_line2 : ''}, ${selected.city}, ${selected.state} ${selected.zip_code}`} />
            </Section>

            {/* Employment */}
            <Section title="Employment">
              <Row label="Status" value={selected.employment_status} />
              <Row label="Employer" value={selected.employer_name || '—'} />
              <Row label="Title" value={selected.job_title || '—'} />
              <Row label="Years Employed" value={selected.years_employed || '—'} />
            </Section>

            {/* Loan */}
            <Section title="Loan Details">
              <Row label="Amount Requested" value={fmt$(selected.loan_amount_requested)} />
              <Row label="Purpose" value={selected.loan_purpose || '—'} />
              <Row label="Travel Date" value={fmtDate(selected.travel_date)} />
              {selected.trip_description && <Row label="Trip Description" value={selected.trip_description} />}
            </Section>

            {/* Financial */}
            <Section title="Financial Profile">
              <Row label="Monthly Income" value={fmt$(selected.monthly_income)} />
              <Row label="Other Income" value={`${fmt$(selected.other_income)}${selected.other_income_source ? ' (' + selected.other_income_source + ')' : ''}`} />
              {dti && <Row label="DTI Ratio" value={`${dti}%`} highlight={parseFloat(dti) > 40} />}
              <Row label="Down Payment" value={fmt$(selected.down_payment)} />
              {selected.bankruptcy_history && <Row label="Bankruptcy" value={selected.bankruptcy_details || 'Yes'} highlight />}
            </Section>

            {/* References */}
            <Section title="References">
              {selected.reference1_name && <Row label={`${selected.reference1_relation || 'Ref 1'}`} value={`${selected.reference1_name} — ${selected.reference1_phone || '—'}`} />}
              {selected.reference2_name && <Row label={`${selected.reference2_relation || 'Ref 2'}`} value={`${selected.reference2_name} — ${selected.reference2_phone || '—'}`} />}
            </Section>

            {/* Consent */}
            <Section title="Consent & Signature">
              <Row label="Credit Check Consent" value={selected.consent_credit_check ? '✅ Yes' : '❌ No'} />
              <Row label="Terms Accepted" value={selected.consent_terms ? '✅ Yes' : '❌ No'} />
            </Section>
          </div>

          {/* Right — Decision panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 20 }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Decision</div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Status</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                  <option value="pending">Pending Review</option>
                  <option value="reviewing">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="denied">Denied</option>
                  <option value="more_info">More Info Needed</option>
                </select>
              </div>

              {newStatus === 'approved' && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Approved Amount ($)</label>
                    <input type="number" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} placeholder={selected.loan_amount_requested?.toString()} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Interest Rate (%)</label>
                    <input type="number" step="0.1" value={approvedRate} onChange={e => setApprovedRate(e.target.value)} placeholder="e.g. 12.9" style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Term (months)</label>
                    <select value={approvedTerm} onChange={e => setApprovedTerm(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                      <option value="">Select term</option>
                      {['12','24','36','48','60'].map(t => <option key={t} value={t}>{t} months</option>)}
                    </select>
                  </div>
                </>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Decision Notes</label>
                <textarea value={decisionNotes} onChange={e => setDecisionNotes(e.target.value)} rows={3} placeholder="Notes for the applicant (may be shared)..." style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Internal Agent Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Internal notes (not shared with applicant)..." style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <button onClick={saveDecision} disabled={saving} style={{ width: '100%', padding: '10px', background: saving ? '#94a3b8' : '#0d1b2a', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Decision'}
              </button>
            </div>

            {/* Quick stats */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Quick Analysis</div>
              {[
                { label: 'Requested', value: fmt$(selected.loan_amount_requested) },
                { label: 'Monthly Income', value: fmt$(selected.monthly_income) },
                { label: 'Obligations', value: fmt$((selected.monthly_rent_mortgage||0)+(selected.monthly_car_payment||0)+(selected.monthly_other_debt||0)) },
                { label: 'Available (est.)', value: selected.monthly_income ? fmt$(selected.monthly_income - (selected.monthly_rent_mortgage||0) - (selected.monthly_car_payment||0) - (selected.monthly_other_debt||0)) : '—' },
                { label: 'DTI', value: dti ? `${dti}%` : '—' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#0d1b2a' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#1e293b' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Loan Applications</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>In-house travel financing applications</p>
        </div>
        <button onClick={fetchApplications} style={{ padding: '7px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>↻ Refresh</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total', value: stats.total, color: '#0d1b2a' },
          { label: 'Pending', value: stats.pending, color: STATUS_COLORS.pending },
          { label: 'Reviewing', value: stats.reviewing, color: STATUS_COLORS.reviewing },
          { label: 'Approved', value: stats.approved, color: STATUS_COLORS.approved },
          { label: 'Total Requested', value: fmt$(stats.totalRequested), color: '#0d1b2a' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, application #..." style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading applications...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No applications found</div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['App #', 'Applicant', 'Amount', 'Purpose', 'Submitted', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((app, i) => (
                <tr key={app.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                >
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{app.application_number}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{app.first_name} {app.last_name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{app.email}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{fmt$(app.loan_amount_requested)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{app.loan_purpose || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748b' }}>{fmtDate(app.created_at)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: (STATUS_COLORS[app.status] || '#94a3b8') + '20', color: STATUS_COLORS[app.status] || '#94a3b8', border: `1px solid ${(STATUS_COLORS[app.status] || '#94a3b8')}40` }}>
                      {STATUS_LABELS[app.status] || app.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => setSelected(app)} style={{ padding: '5px 12px', background: '#0d1b2a', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 4 }}>
      <span style={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: highlight ? '#ef4444' : '#0d1b2a', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
