'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  smtpAccount: { name: string; email: string };
  contactList: { name: string };
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
  _count: { campaignEmails: number; followUpSteps: number };
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => { fetchCampaigns(); }, [filter]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      const res = await fetch(`/api/campaigns?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      DRAFT: { cls: 'badge-gray', label: 'Draft' },
      SCHEDULED: { cls: 'badge-blue', label: 'Scheduled' },
      SENDING: { cls: 'badge-purple', label: 'Sending' },
      PAUSED: { cls: 'badge-orange', label: 'Paused' },
      COMPLETED: { cls: 'badge-green', label: 'Completed' },
      CANCELLED: { cls: 'badge-red', label: 'Cancelled' },
    };
    return map[status] || { cls: 'badge-gray', label: status };
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Manage your cold outreach campaigns</p>
        </div>
        <div className="page-actions">
          <Link href="/campaigns/new" className="btn btn-primary">
            ✨ New Campaign
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs">
        {['', 'DRAFT', 'SENDING', 'COMPLETED', 'PAUSED'].map((f) => (
          <button
            key={f}
            className={`tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card">
          <div className="card-body">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton skeleton-line" style={{ height: '60px', marginBottom: '12px' }} />
            ))}
          </div>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📧</div>
            <h3 className="empty-state-title">No campaigns found</h3>
            <p className="empty-state-description">
              {filter ? `No ${filter.toLowerCase()} campaigns.` : 'Create your first campaign to start reaching prospects.'}
            </p>
            <Link href="/campaigns/new" className="btn btn-primary">✨ Create Campaign</Link>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>From</th>
                  <th>List</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Replied</th>
                  <th>Bounced</th>
                  <th>Follow-ups</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const badge = getStatusBadge(c.status);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/campaigns/${c.id}`} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                          {c.name}
                        </Link>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          {c.subject}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${badge.cls}`}>
                          <span className="badge-dot" />
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        {c.smtpAccount.name}
                      </td>
                      <td>
                        <span className="badge badge-blue">{c.contactList.name}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.sent}</td>
                      <td style={{ color: 'var(--success)' }}>{c.opened}</td>
                      <td style={{ color: 'var(--accent)' }}>{c.replied}</td>
                      <td style={{ color: c.bounced > 0 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                        {c.bounced}
                      </td>
                      <td>{c._count.followUpSteps}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
