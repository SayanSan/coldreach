'use client';

import { useState, FormEvent } from 'react';

interface DomainReport {
  domain: string;
  score: number;
  scoreLabel: string;
  spf: { status: string; record: string | null; recommendation: string };
  dkim: { status: string; selector: string; recommendation: string };
  dmarc: { status: string; record: string | null; recommendation: string };
  mx: string[];
}

export default function DeliverabilityPage() {
  const [domain, setDomain] = useState('');
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<DomainReport | null>(null);

  const handleCheck = async (e: FormEvent) => {
    e.preventDefault();
    if (!domain) return;
    setChecking(true);
    setReport(null);
    try {
      const res = await fetch('/api/deliverability/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (error) {
      console.error('Domain check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'PASS') return '✅';
    if (status === 'FAIL') return '❌';
    return '⚠️';
  };

  const getStatusClass = (status: string) => {
    if (status === 'PASS') return 'pass';
    if (status === 'FAIL') return 'fail';
    return 'missing';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Deliverability</h1>
          <p className="page-subtitle">Monitor your email sending reputation and domain health</p>
        </div>
      </div>

      {/* Domain Check */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card-header">
          <h2 className="card-title">🛡️ Domain Health Check</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleCheck} style={{ display: 'flex', gap: 'var(--space-sm)', maxWidth: '500px' }}>
            <input
              className="form-input"
              placeholder="Enter your domain (e.g., yourcompany.com)"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={checking} style={{ whiteSpace: 'nowrap' }}>
              {checking ? <><span className="spinner" /> Checking...</> : '🔍 Check'}
            </button>
          </form>
        </div>
      </div>

      {/* Results */}
      {report && (
        <div className="animate-slide-up">
          {/* Score */}
          <div className="card" style={{ marginBottom: 'var(--space-xl)', textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto var(--space-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-3xl)', fontWeight: 800,
              background: report.score === 3 ? 'var(--success-muted)' : report.score >= 2 ? 'var(--warning-muted)' : 'var(--danger-muted)',
              color: report.score === 3 ? 'var(--success)' : report.score >= 2 ? 'var(--warning)' : 'var(--danger)',
            }}>
              {report.score}/3
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
              {report.scoreLabel}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              {report.domain}
            </div>
          </div>

          {/* Checks */}
          <div className="health-checks">
            {/* SPF */}
            <div className="health-check-item">
              <div className={`health-check-status ${getStatusClass(report.spf.status)}`}>
                {getStatusIcon(report.spf.status)}
              </div>
              <div className="health-check-label">SPF</div>
              <div className="health-check-detail">
                {report.spf.record || report.spf.recommendation}
              </div>
            </div>

            {/* DKIM */}
            <div className="health-check-item">
              <div className={`health-check-status ${getStatusClass(report.dkim.status)}`}>
                {getStatusIcon(report.dkim.status)}
              </div>
              <div className="health-check-label">DKIM</div>
              <div className="health-check-detail">
                {report.dkim.recommendation}
              </div>
            </div>

            {/* DMARC */}
            <div className="health-check-item">
              <div className={`health-check-status ${getStatusClass(report.dmarc.status)}`}>
                {getStatusIcon(report.dmarc.status)}
              </div>
              <div className="health-check-label">DMARC</div>
              <div className="health-check-detail">
                {report.dmarc.record || report.dmarc.recommendation}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
            <div className="card-header">
              <h2 className="card-title">📋 Recommendations</h2>
            </div>
            <div className="card-body">
              {[
                { label: 'SPF', status: report.spf.status, rec: report.spf.recommendation },
                { label: 'DKIM', status: report.dkim.status, rec: report.dkim.recommendation },
                { label: 'DMARC', status: report.dmarc.status, rec: report.dmarc.recommendation },
              ]
                .filter((r) => r.rec)
                .map((r) => (
                  <div key={r.label} style={{
                    padding: 'var(--space-md)',
                    background: r.status === 'PASS' ? 'var(--success-muted)' : 'var(--warning-muted)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-sm)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    <strong>{r.label}:</strong> {r.rec}
                  </div>
                ))}

              {report.mx.length > 0 && (
                <div style={{ marginTop: 'var(--space-md)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>MX RECORDS</div>
                  {report.mx.map((mx, i) => (
                    <div key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {mx}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Whitelisting Guide */}
          <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
            <div className="card-header">
              <h2 className="card-title">📖 Google Workspace Whitelisting Guide</h2>
            </div>
            <div className="card-body">
              {[
                { step: 1, title: 'Set up SPF', desc: `Add a TXT record to your DNS:\nv=spf1 include:_spf.google.com ~all` },
                { step: 2, title: 'Enable DKIM', desc: 'Go to Google Admin Console → Apps → Google Workspace → Gmail → Authenticate email → Generate DKIM key → Add the TXT record to your DNS.' },
                { step: 3, title: 'Configure DMARC', desc: `Add a TXT record at _dmarc.${report.domain}:\nv=DMARC1; p=none; rua=mailto:dmarc@${report.domain}` },
                { step: 4, title: 'Register Google Postmaster Tools', desc: 'Visit postmaster.google.com → Add your domain → Verify ownership → Monitor your sending reputation.' },
                { step: 5, title: 'Warm Up Gradually', desc: 'Start with 20-30 emails/day and increase by 5-10 per day. Avoid sending bulk from a new address.' },
                { step: 6, title: 'Monitor Bounce Rate', desc: 'Keep bounce rate under 2% and complaint rate under 0.1% to maintain good sender reputation.' },
              ].map((s) => (
                <div key={s.step} style={{
                  display: 'flex', gap: 'var(--space-md)', padding: 'var(--space-md) 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'var(--accent-muted)', color: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0,
                  }}>{s.step}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '4px' }}>{s.title}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
