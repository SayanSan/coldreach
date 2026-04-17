'use client';

import { useEffect, useState, FormEvent } from 'react';

interface SmtpAccount {
  id: string;
  name: string;
  email: string;
  host: string;
  port: number;
  username: string;
  useTls: boolean;
  dailyLimit: number;
  sentToday: number;
  warmUpEnabled: boolean;
  warmUpDailyLimit: number;
  warmUpIncrement: number;
  warmUpTargetLimit: number;
  isActive: boolean;
  imapHost: string | null;
  imapPort: number | null;
  createdAt: string;
}

export default function SmtpPage() {
  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [editAccount, setEditAccount] = useState<SmtpAccount | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    host: 'smtp.gmail.com',
    port: '587',
    username: '',
    password: '',
    useTls: true,
    dailyLimit: '500',
    imapHost: '',
    imapPort: '993',
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/smtp');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Failed to fetch SMTP accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const method = editAccount ? 'PUT' : 'POST';
      const body = editAccount
        ? { id: editAccount.id, ...formData }
        : formData;

      const res = await fetch('/api/smtp', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowModal(false);
        setEditAccount(null);
        resetForm();
        fetchAccounts();
      }
    } catch (error) {
      console.error('Failed to save SMTP account:', error);
    }
  };

  const handleTest = async (account?: SmtpAccount) => {
    const testData = account
      ? {
          host: account.host,
          port: account.port,
          username: account.username,
          password: formData.password || 'stored',
        }
      : {
          host: formData.host,
          port: parseInt(formData.port),
          username: formData.username,
          password: formData.password,
        };

    if (account) setTesting(account.id);
    setTestResult(null);

    try {
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: 'Test failed' });
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this SMTP account?')) return;
    try {
      await fetch(`/api/smtp?id=${id}`, { method: 'DELETE' });
      fetchAccounts();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      host: 'smtp.gmail.com',
      port: '587',
      username: '',
      password: '',
      useTls: true,
      dailyLimit: '500',
      imapHost: '',
      imapPort: '993',
    });
  };

  const openEdit = (account: SmtpAccount) => {
    setEditAccount(account);
    setFormData({
      name: account.name,
      email: account.email,
      host: account.host,
      port: String(account.port),
      username: account.username,
      password: '',
      useTls: account.useTls,
      dailyLimit: String(account.dailyLimit),
      imapHost: account.imapHost || '',
      imapPort: String(account.imapPort || 993),
    });
    setShowModal(true);
  };

  const openAdd = () => {
    setEditAccount(null);
    resetForm();
    setShowModal(true);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">SMTP Accounts</h1>
          <p className="page-subtitle">
            Manage your email sending accounts and configure SMTP settings
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAdd}>
            + Add Account
          </button>
        </div>
      </div>

      {loading ? (
        <div className="stats-grid">
          {[1, 2].map((i) => (
            <div key={i} className="stat-card">
              <div className="skeleton skeleton-card" />
            </div>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📬</div>
            <h3 className="empty-state-title">No SMTP accounts configured</h3>
            <p className="empty-state-description">
              Add your Google Workspace or other SMTP credentials to start sending campaigns.
            </p>
            <button className="btn btn-primary" onClick={openAdd}>
              + Add SMTP Account
            </button>
          </div>
        </div>
      ) : (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {accounts.map((account) => (
            <div
              key={account.id}
              className="stat-card"
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className={`stat-card-icon ${account.isActive ? 'green' : 'red'}`}>
                    📧
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                      {account.name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {account.email}
                    </div>
                  </div>
                </div>
                <span className={`badge ${account.isActive ? 'badge-green' : 'badge-red'}`}>
                  <span className="badge-dot" />
                  {account.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ marginTop: 'var(--space-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  <span>Daily Usage</span>
                  <span>{account.sentToday} / {account.dailyLimit}</span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill ${
                      account.sentToday / account.dailyLimit > 0.8
                        ? 'red'
                        : account.sentToday / account.dailyLimit > 0.5
                        ? 'orange'
                        : 'green'
                    }`}
                    style={{
                      width: `${Math.min((account.sentToday / account.dailyLimit) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                <span>{account.host}:{account.port}</span>
                <span>•</span>
                <span>{account.useTls ? 'TLS' : 'No TLS'}</span>
                {account.warmUpEnabled && (
                  <>
                    <span>•</span>
                    <span style={{ color: 'var(--warning)' }}>🔥 Warm-up</span>
                  </>
                )}
              </div>

              <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(account)}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(account.id)}>
                  Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => { setShowModal(false); setEditAccount(null); }}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editAccount ? 'Edit SMTP Account' : 'Add SMTP Account'}
              </h2>
              <button className="modal-close" onClick={() => { setShowModal(false); setEditAccount(null); }}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Account Name</label>
                    <input
                      className="form-input"
                      placeholder="e.g., Main Outreach"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">From Email</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="sales@yourcompany.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">SMTP Host</label>
                    <input
                      className="form-input"
                      placeholder="smtp.gmail.com"
                      value={formData.host}
                      onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Port</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="587"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Daily Limit</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="500"
                      value={formData.dailyLimit}
                      onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      className="form-input"
                      placeholder="your@email.com"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Password {editAccount && '(leave blank to keep current)'}
                    </label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="App Password or SMTP password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editAccount}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">IMAP Host (for reply detection)</label>
                    <input
                      className="form-input"
                      placeholder="Auto-detected from SMTP host"
                      value={formData.imapHost}
                      onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                    />
                    <span className="form-hint">Leave blank to auto-detect</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">IMAP Port</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="993"
                      value={formData.imapPort}
                      onChange={(e) => setFormData({ ...formData, imapPort: e.target.value })}
                    />
                  </div>
                </div>

                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.useTls}
                    onChange={(e) => setFormData({ ...formData, useTls: e.target.checked })}
                  />
                  <span>Use TLS encryption</span>
                </label>

                {testResult && (
                  <div
                    className={`login-error`}
                    style={{
                      background: testResult.success ? 'var(--success-muted)' : 'var(--danger-muted)',
                      color: testResult.success ? 'var(--success)' : 'var(--danger)',
                      borderColor: testResult.success ? 'rgba(45,180,100,0.3)' : undefined,
                    }}
                  >
                    {testResult.success ? '✅ ' : '❌ '}
                    {testResult.message}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleTest()}
                  disabled={!formData.host || !formData.username || !formData.password || testing !== null}
                >
                  {testing ? (
                    <>
                      <span className="spinner" />
                      Testing...
                    </>
                  ) : (
                    '🔌 Test Connection'
                  )}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowModal(false); setEditAccount(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editAccount ? 'Update' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
