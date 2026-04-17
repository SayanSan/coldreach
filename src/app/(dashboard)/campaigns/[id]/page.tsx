'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

interface CampaignDetail {
  id: string;
  name: string;
  subject: string;
  bodyText: string | null;
  status: string;
  fromName: string | null;
  sendRatePerHour: number;
  smtpAccount: { name: string; email: string };
  contactList: { name: string };
  followUpSteps: { id: string; stepNumber: number; delayDays: number; subject: string; condition: string }[];
  createdAt: string;
  startedAt: string | null;
}

interface CampaignStats {
  total: number;
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
  bounced: number;
  failed: number;
}

interface CampaignEmail {
  id: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  repliedAt: string | null;
  contact: { email: string; firstName: string | null; lastName: string | null; company: string | null };
}

const SENDING_STATUSES = new Set(['SENDING']);

export default function CampaignDetailPage() {
  const params = useParams();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [emails, setEmails] = useState<CampaignEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchCampaign();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/campaigns/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setCampaign(data.campaign);
        setStats(data.stats);
        setEmails(data.emails || []);

        // Auto-poll while sending
        if (SENDING_STATUSES.has(data.campaign.status)) {
          if (!pollRef.current) {
            pollRef.current = setInterval(fetchCampaign, 5000);
          }
        } else {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!confirm('Start sending this campaign? This will begin emailing all contacts in the list.')) return;
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/campaigns/${params.id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Failed to send');
    } catch (error) {
      console.error('Failed to send:', error);
    } finally {
      setActionInProgress(false);
      fetchCampaign();
    }
  };

  const handleAction = async (action: 'pause' | 'resume' | 'cancel') => {
    const confirmMsg =
      action === 'cancel'
        ? 'Cancel this campaign? This cannot be undone.'
        : action === 'pause'
        ? 'Pause this campaign?'
        : 'Resume this campaign?';
    if (!confirm(confirmMsg)) return;
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/campaigns/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || `Failed to ${action}`);
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
    } finally {
      setActionInProgress(false);
      fetchCampaign();
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      QUEUED: 'badge-gray', SENDING: 'badge-purple', SENT: 'badge-blue',
      DELIVERED: 'badge-blue', OPENED: 'badge-green', REPLIED: 'badge-green',
      BOUNCED: 'badge-red', FAILED: 'badge-red',
      DRAFT: 'badge-gray', SCHEDULED: 'badge-blue',
      PAUSED: 'badge-orange', COMPLETED: 'badge-green', CANCELLED: 'badge-red',
    };
    return map[status] || 'badge-gray';
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton skeleton-card" style={{ height: '200px', marginBottom: '20px' }} />
        <div className="skeleton skeleton-card" style={{ height: '400px' }} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="page-container">
        <div className="empty-state"><h3 className="empty-state-title">Campaign not found</h3></div>
      </div>
    );
  }

  const s = stats || { total: 0, queued: 0, sending: 0, sent: 0, delivered: 0, opened: 0, replied: 0, bounced: 0, failed: 0 };
  const isSending = campaign.status === 'SENDING';
  const progress = s.total > 0 ? Math.round(((s.sent + s.delivered + s.opened + s.replied + s.failed) / s.total) * 100) : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{campaign.name}</h1>
          <p className="page-subtitle">{campaign.subject}</p>
        </div>
        <div className="page-actions">
          <span className={`badge ${getStatusBadge(campaign.status)}`} style={{ padding: '6px 14px', fontSize: '13px' }}>
            <span className="badge-dot" />
            {campaign.status}
            {isSending && <span className="spinner" style={{ marginLeft: '6px' }} />}
          </span>

          {(campaign.status === 'DRAFT' || campaign.status === 'PAUSED') && (
            <button className="btn btn-primary" onClick={handleSend} disabled={actionInProgress}>
              {actionInProgress ? <><span className="spinner" /> Starting...</> : '🚀 Start Campaign'}
            </button>
          )}

          {campaign.status === 'SENDING' && (
            <button className="btn btn-secondary" onClick={() => handleAction('pause')} disabled={actionInProgress}>
              ⏸ Pause
            </button>
          )}

          {(campaign.status === 'DRAFT' || campaign.status === 'PAUSED' || campaign.status === 'SENDING') && (
            <button
              className="btn btn-secondary"
              style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
              onClick={() => handleAction('cancel')}
              disabled={actionInProgress}
            >
              ✕ Cancel
            </button>
          )}
        </div>
      </div>

      {/* Sending progress bar */}
      {isSending && s.total > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md) var(--space-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Sending in progress…</span>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{progress}%</span>
          </div>
          <div className="progress-bar" style={{ height: '8px' }}>
            <div style={{ height: '100%', borderRadius: 'var(--radius-full)', width: `${progress}%`, background: 'var(--accent)', transition: 'width 1s ease' }} />
          </div>
          <div style={{ marginTop: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {s.sent + s.delivered + s.opened + s.replied} sent · {s.failed} failed · {s.queued + s.sending} remaining — auto-refreshing every 5 s
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid stagger-children">
        <div className="stat-card">
          <div className="stat-card-header"><div className="stat-card-icon blue">📧</div></div>
          <div className="stat-card-value">{s.total}</div>
          <div className="stat-card-label">Total Emails</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><div className="stat-card-icon green">📬</div></div>
          <div className="stat-card-value">{s.opened}</div>
          <div className="stat-card-label">Opened ({s.total > 0 ? Math.round((s.opened / s.total) * 100) : 0}%)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><div className="stat-card-icon purple">💬</div></div>
          <div className="stat-card-value">{s.replied}</div>
          <div className="stat-card-label">Replied ({s.total > 0 ? Math.round((s.replied / s.total) * 100) : 0}%)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><div className="stat-card-icon red">🔴</div></div>
          <div className="stat-card-value">{s.bounced + s.failed}</div>
          <div className="stat-card-label">Bounced / Failed</div>
        </div>
      </div>

      {/* Funnel */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card-header"><h2 className="card-title">Campaign Funnel</h2></div>
        <div className="card-body">
          {[
            { label: 'Queued', value: s.queued + s.sending, color: 'var(--text-tertiary)' },
            { label: 'Sent', value: s.sent + s.delivered + s.opened + s.replied, color: 'var(--accent)' },
            { label: 'Opened', value: s.opened + s.replied, color: 'var(--success)' },
            { label: 'Replied', value: s.replied, color: 'hsl(270, 80%, 65%)' },
          ].map((item) => (
            <div key={item.label} style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: item.color }}>{item.value}</span>
              </div>
              <div className="progress-bar">
                <div style={{
                  height: '100%', borderRadius: 'var(--radius-full)',
                  width: `${s.total > 0 ? (item.value / s.total) * 100 : 0}%`,
                  background: item.color,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Emails Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Emails ({emails.length})</h2>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Company</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Opened</th>
                <th>Replied</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{e.contact.email}</div>
                    {(e.contact.firstName || e.contact.lastName) && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {`${e.contact.firstName || ''} ${e.contact.lastName || ''}`.trim()}
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{e.contact.company || '—'}</td>
                  <td><span className={`badge ${getStatusBadge(e.status)}`}><span className="badge-dot" />{e.status}</span></td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {e.sentAt ? new Date(e.sentAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {e.openedAt ? new Date(e.openedAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {e.repliedAt ? new Date(e.repliedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
              {emails.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px' }}>No emails yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Follow-up Steps */}
      {campaign.followUpSteps.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
          <div className="card-header"><h2 className="card-title">Follow-up Sequence</h2></div>
          <div className="card-body">
            {campaign.followUpSteps.map((step, i) => (
              <div key={step.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                padding: 'var(--space-md)', background: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)', marginBottom: i < campaign.followUpSteps.length - 1 ? 'var(--space-sm)' : 0,
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'var(--accent-muted)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0,
                }}>{step.stepNumber}</div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{step.subject || `Follow-up #${step.stepNumber}`}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {step.delayDays} days after · Condition: {step.condition.replace('_', ' ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
