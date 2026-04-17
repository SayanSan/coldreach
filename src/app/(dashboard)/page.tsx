'use client';

import { useEffect, useState } from 'react';

interface DashboardStats {
  emailsSentToday: number;
  emailsSentWeek: number;
  emailsSentMonth: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
  activeCampaigns: number;
  totalContacts: number;
  hotLeads: number;
  smtpAccounts: number;
}

interface RecentCampaign {
  id: string;
  name: string;
  status: string;
  sent: number;
  opened: number;
  replied: number;
  createdAt: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<RecentCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, campaignsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/campaigns?limit=5'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        setCampaigns(campaignsData.campaigns || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: 'badge-gray',
      SCHEDULED: 'badge-blue',
      SENDING: 'badge-purple',
      PAUSED: 'badge-orange',
      COMPLETED: 'badge-green',
      CANCELLED: 'badge-red',
    };
    return map[status] || 'badge-gray';
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Your outreach command center</p>
          </div>
        </div>
        <div className="stats-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card">
              <div className="skeleton skeleton-card" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const s = stats || {
    emailsSentToday: 0,
    emailsSentWeek: 0,
    emailsSentMonth: 0,
    openRate: 0,
    replyRate: 0,
    bounceRate: 0,
    activeCampaigns: 0,
    totalContacts: 0,
    hotLeads: 0,
    smtpAccounts: 0,
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Your outreach command center</p>
        </div>
        <div className="page-actions">
          <a href="/campaigns/new" className="btn btn-primary">
            ✨ New Campaign
          </a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid stagger-children">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">📧</div>
          </div>
          <div className="stat-card-value">{s.emailsSentToday}</div>
          <div className="stat-card-label">Emails Sent Today</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">📬</div>
          </div>
          <div className="stat-card-value">{s.openRate}%</div>
          <div className="stat-card-label">Open Rate</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon purple">💬</div>
          </div>
          <div className="stat-card-value">{s.replyRate}%</div>
          <div className="stat-card-label">Reply Rate</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon orange">⚡</div>
          </div>
          <div className="stat-card-value">{s.hotLeads}</div>
          <div className="stat-card-label">Hot Leads</div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="stats-grid stagger-children" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">📊</div>
          </div>
          <div className="stat-card-value">{s.activeCampaigns}</div>
          <div className="stat-card-label">Active Campaigns</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">👥</div>
          </div>
          <div className="stat-card-value">{s.totalContacts}</div>
          <div className="stat-card-label">Total Contacts</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon red">🔴</div>
          </div>
          <div className="stat-card-value">{s.bounceRate}%</div>
          <div className="stat-card-label">Bounce Rate</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon purple">📬</div>
          </div>
          <div className="stat-card-value">{s.smtpAccounts}</div>
          <div className="stat-card-label">SMTP Accounts</div>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Campaigns</h2>
          <a href="/campaigns" className="btn btn-ghost btn-sm">
            View All →
          </a>
        </div>
        {campaigns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📧</div>
            <h3 className="empty-state-title">No campaigns yet</h3>
            <p className="empty-state-description">
              Create your first cold outreach campaign to start reaching prospects.
            </p>
            <a href="/campaigns/new" className="btn btn-primary">
              ✨ Create Campaign
            </a>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Replied</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <a href={`/campaigns/${campaign.id}`} style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {campaign.name}
                      </a>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(campaign.status)}`}>
                        <span className="badge-dot" />
                        {campaign.status}
                      </span>
                    </td>
                    <td>{campaign.sent}</td>
                    <td>{campaign.opened}</td>
                    <td>{campaign.replied}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
