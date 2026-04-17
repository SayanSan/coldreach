'use client';

import { useEffect, useState } from 'react';

interface Settings {
  can_spam_address: string;
  default_send_rate: string;
  default_followup_delay: string;
  timezone: string;
  openai_api_key: string;
  ai_model: string;
}

const DEFAULT_SETTINGS: Settings = {
  can_spam_address: '',
  default_send_rate: '50',
  default_followup_delay: '3',
  timezone: 'Asia/Kolkata',
  openai_api_key: '',
  ai_model: 'gpt-4o-mini',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [generalMsg, setGeneralMsg] = useState('');
  const [aiMsg, setAiMsg] = useState('');

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    } finally {
      setLoading(false);
    }
  };

  const saveGeneral = async () => {
    setSavingGeneral(true);
    setGeneralMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          can_spam_address: settings.can_spam_address,
          default_send_rate: settings.default_send_rate,
          default_followup_delay: settings.default_followup_delay,
          timezone: settings.timezone,
        }),
      });
      setGeneralMsg(res.ok ? '✓ Settings saved' : '✗ Failed to save');
    } catch {
      setGeneralMsg('✗ Failed to save');
    } finally {
      setSavingGeneral(false);
      setTimeout(() => setGeneralMsg(''), 3000);
    }
  };

  const saveAi = async () => {
    setSavingAi(true);
    setAiMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openai_api_key: settings.openai_api_key,
          ai_model: settings.ai_model,
        }),
      });
      setAiMsg(res.ok ? '✓ AI settings saved' : '✗ Failed to save');
      if (res.ok) {
        // Re-fetch so masked key is shown
        fetchSettings();
      }
    } catch {
      setAiMsg('✗ Failed to save');
    } finally {
      setSavingAi(false);
      setTimeout(() => setAiMsg(''), 3000);
    }
  };

  const set = (key: keyof Settings) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setSettings((prev) => ({ ...prev, [key]: e.target.value }));

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton skeleton-card" style={{ height: '200px', marginBottom: '20px' }} />
        <div className="skeleton skeleton-card" style={{ height: '200px' }} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your ColdReach preferences</p>
        </div>
      </div>

      {/* ── General Settings ───────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card-header">
          <h2 className="card-title">⚙️ General Settings</h2>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div className="form-group">
            <label className="form-label">CAN-SPAM Physical Address</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: '80px' }}
              placeholder={`Your Company Name\n123 Business Street\nCity, State ZIP\nCountry`}
              value={settings.can_spam_address}
              onChange={set('can_spam_address')}
            />
            <span className="form-hint">Required for CAN-SPAM compliance. This address appears at the bottom of every email.</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Default Send Rate (emails/hour)</label>
              <input
                className="form-input"
                type="number"
                value={settings.default_send_rate}
                onChange={set('default_send_rate')}
                min="5"
                max="500"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Default Follow-up Delay (days)</label>
              <input
                className="form-input"
                type="number"
                value={settings.default_followup_delay}
                onChange={set('default_followup_delay')}
                min="1"
                max="30"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Timezone</label>
            <select className="form-select" value={settings.timezone} onChange={set('timezone')}>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Europe/Berlin">Europe/Berlin (CET)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <button className="btn btn-primary" onClick={saveGeneral} disabled={savingGeneral}>
              {savingGeneral ? <><span className="spinner" /> Saving...</> : 'Save Settings'}
            </button>
            {generalMsg && (
              <span style={{ fontSize: 'var(--text-sm)', color: generalMsg.startsWith('✓') ? 'var(--success)' : 'var(--error)' }}>
                {generalMsg}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── AI Configuration ───────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card-header">
          <h2 className="card-title">🤖 AI Configuration</h2>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="form-group">
            <label className="form-label">OpenAI API Key</label>
            <input
              className="form-input"
              type="password"
              placeholder={settings.openai_api_key === '••••••••' ? 'API key is set (enter new key to update)' : 'sk-...'}
              value={settings.openai_api_key === '••••••••' ? '' : settings.openai_api_key}
              onChange={set('openai_api_key')}
            />
            <span className="form-hint">
              Used for AI-powered reply classification and lead scoring. Your key is encrypted at rest.
              {settings.openai_api_key === '••••••••' && (
                <span style={{ color: 'var(--success)', marginLeft: '8px' }}>● Key is configured</span>
              )}
            </span>
          </div>
          <div className="form-group">
            <label className="form-label">AI Model</label>
            <select className="form-select" value={settings.ai_model} onChange={set('ai_model')}>
              <option value="gpt-4o-mini">GPT-4o Mini (Recommended — lowest cost)</option>
              <option value="gpt-4o">GPT-4o (Higher accuracy)</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Cheapest)</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <button className="btn btn-primary" onClick={saveAi} disabled={savingAi}>
              {savingAi ? <><span className="spinner" /> Saving...</> : 'Save AI Settings'}
            </button>
            {aiMsg && (
              <span style={{ fontSize: 'var(--text-sm)', color: aiMsg.startsWith('✓') ? 'var(--success)' : 'var(--error)' }}>
                {aiMsg}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Workers ────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">⚙️ Background Workers</h2>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            Manually trigger background workers. In production these would run on a schedule via cron or Upstash QStash.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <WorkerButton
              label="Check Replies (IMAP)"
              href="/api/workers/check-replies"
              description="Poll IMAP mailboxes for new replies and create leads"
            />
            <WorkerButton
              label="Process Follow-ups"
              href="/api/workers/process-followups"
              description="Send due follow-up emails based on campaign sequences"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkerButton({ label, href, description }: { label: string; href: string; description: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState('');

  const run = async () => {
    setRunning(true);
    setResult('');
    try {
      const res = await fetch(href, { method: 'POST' });
      const data = await res.json();
      setResult(res.ok ? `✓ ${data.message || 'Done'}` : `✗ ${data.error || 'Failed'}`);
    } catch {
      setResult('✗ Request failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', minWidth: '220px' }}>
      <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>{description}</div>
      <button className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', padding: '6px 12px' }} onClick={run} disabled={running}>
        {running ? <><span className="spinner" /> Running...</> : 'Run Now'}
      </button>
      {result && (
        <div style={{ marginTop: '8px', fontSize: 'var(--text-xs)', color: result.startsWith('✓') ? 'var(--success)' : 'var(--error)' }}>
          {result}
        </div>
      )}
    </div>
  );
}
