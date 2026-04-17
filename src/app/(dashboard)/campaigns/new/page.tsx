'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface SmtpAccount { id: string; name: string; email: string; }
interface ContactList { id: string; name: string; _count: { members: number }; }

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    fromName: '',
    smtpAccountId: '',
    contactListId: '',
    bodyHtml: '',
    bodyText: '',
    sendRatePerHour: 50,
  });

  const [followUps, setFollowUps] = useState<{
    subject: string;
    bodyText: string;
    delayDays: number;
    condition: string;
  }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [smtpRes, listsRes] = await Promise.all([
      fetch('/api/smtp'),
      fetch('/api/contacts/lists'),
    ]);
    if (smtpRes.ok) {
      const data = await smtpRes.json();
      setSmtpAccounts(data.accounts || []);
    }
    if (listsRes.ok) {
      const data = await listsRes.json();
      setContactLists(data.lists || []);
    }
  };

  const mergeFields = ['{{firstName}}', '{{lastName}}', '{{company}}', '{{title}}', '{{email}}'];

  const insertMergeField = (field: string) => {
    setFormData({ ...formData, bodyText: formData.bodyText + field });
  };

  const addFollowUp = () => {
    setFollowUps([...followUps, { subject: '', bodyText: '', delayDays: 3, condition: 'NO_REPLY' }]);
  };

  const removeFollowUp = (index: number) => {
    setFollowUps(followUps.filter((_, i) => i !== index));
  };

  const updateFollowUp = (index: number, field: string, value: string | number) => {
    const updated = [...followUps];
    updated[index] = { ...updated[index], [field]: value };
    setFollowUps(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          followUpSteps: followUps.map((f) => ({
            ...f,
            bodyHtml: `<p>${f.bodyText.replace(/\n/g, '</p><p>')}</p>`,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/campaigns/${data.campaign.id}`);
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { num: 1, label: 'Basics' },
    { num: 2, label: 'Compose' },
    { num: 3, label: 'Follow-ups' },
    { num: 4, label: 'Review' },
  ];

  const canProceed = () => {
    if (step === 1) return formData.name && formData.subject && formData.smtpAccountId && formData.contactListId;
    if (step === 2) return formData.bodyText;
    return true;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Create Campaign</h1>
          <p className="page-subtitle">Set up a new cold outreach campaign</p>
        </div>
      </div>

      {/* Wizard Steps */}
      <div className="wizard-steps">
        {steps.map((s, i) => (
          <div key={s.num} style={{ display: 'contents' }}>
            <div className={`wizard-step ${step === s.num ? 'active' : step > s.num ? 'completed' : ''}`}>
              <div className="wizard-step-number">
                {step > s.num ? '✓' : s.num}
              </div>
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`wizard-step-connector ${step > s.num ? 'completed' : ''}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Basics */}
        {step === 1 && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h2 className="card-title">Campaign Basics</h2>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">Campaign Name *</label>
                <input className="form-input" placeholder="e.g., SaaS Founders Q1 Outreach"
                  value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Subject Line *</label>
                  <input className="form-input" placeholder="e.g., Quick question about {{company}}"
                    value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} required />
                  <span className="form-hint">Use merge fields: {'{{firstName}}'}, {'{{company}}'}, etc.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">From Name</label>
                  <input className="form-input" placeholder="e.g., John from Acme"
                    value={formData.fromName} onChange={(e) => setFormData({ ...formData, fromName: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">SMTP Account *</label>
                  <select className="form-select" value={formData.smtpAccountId}
                    onChange={(e) => setFormData({ ...formData, smtpAccountId: e.target.value })} required>
                    <option value="">Select account...</option>
                    {smtpAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Contact List *</label>
                  <select className="form-select" value={formData.contactListId}
                    onChange={(e) => setFormData({ ...formData, contactListId: e.target.value })} required>
                    <option value="">Select list...</option>
                    {contactLists.map((l) => (
                      <option key={l.id} value={l.id}>{l.name} ({l._count.members} contacts)</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ maxWidth: '200px' }}>
                <label className="form-label">Send Rate (emails/hour)</label>
                <input className="form-input" type="number" min="5" max="200"
                  value={formData.sendRatePerHour} onChange={(e) => setFormData({ ...formData, sendRatePerHour: parseInt(e.target.value) })} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Compose */}
        {step === 2 && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h2 className="card-title">Compose Email</h2>
              <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                {mergeFields.map((field) => (
                  <button key={field} type="button" className="btn btn-secondary btn-sm" onClick={() => insertMergeField(field)}>
                    {field}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Email Body *</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '300px', fontFamily: 'var(--font-sans)' }}
                  placeholder={`Hi {{firstName}},\n\nI noticed {{company}} is doing great work in...\n\nWould love to connect and share how we can help.\n\nBest,\nYour Name`}
                  value={formData.bodyText}
                  onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
                  required
                />
                <span className="form-hint">Plain text recommended for cold outreach. Merge fields will be replaced with contact data.</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Follow-ups */}
        {step === 3 && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h2 className="card-title">Follow-up Sequence</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addFollowUp}>
                + Add Follow-up
              </button>
            </div>
            <div className="card-body">
              {followUps.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                  <div className="empty-state-icon">🔄</div>
                  <h3 className="empty-state-title">No follow-ups configured</h3>
                  <p className="empty-state-description">
                    Add automated follow-up emails for contacts who don&apos;t reply.
                  </p>
                  <button type="button" className="btn btn-primary" onClick={addFollowUp}>
                    + Add Follow-up
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                  {followUps.map((fu, i) => (
                    <div key={i} style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Follow-up #{i + 1}</h3>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeFollowUp(i)}>Remove</button>
                      </div>
                      <div className="form-row-3">
                        <div className="form-group">
                          <label className="form-label">Delay (days)</label>
                          <input className="form-input" type="number" min="1" max="30"
                            value={fu.delayDays} onChange={(e) => updateFollowUp(i, 'delayDays', parseInt(e.target.value))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Condition</label>
                          <select className="form-select" value={fu.condition}
                            onChange={(e) => updateFollowUp(i, 'condition', e.target.value)}>
                            <option value="NO_REPLY">No Reply</option>
                            <option value="NO_OPEN">No Open</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Subject</label>
                          <input className="form-input" placeholder="Re: {{originalSubject}}"
                            value={fu.subject} onChange={(e) => updateFollowUp(i, 'subject', e.target.value)} />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                        <label className="form-label">Body</label>
                        <textarea className="form-textarea" style={{ minHeight: '100px' }}
                          placeholder="Just following up on my previous email..."
                          value={fu.bodyText} onChange={(e) => updateFollowUp(i, 'bodyText', e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <h2 className="card-title">Review & Create</h2>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>CAMPAIGN NAME</div>
                  <div style={{ fontWeight: 600 }}>{formData.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>SUBJECT</div>
                  <div style={{ fontWeight: 600 }}>{formData.subject}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>SMTP ACCOUNT</div>
                  <div>{smtpAccounts.find((a) => a.id === formData.smtpAccountId)?.name || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>CONTACT LIST</div>
                  <div>{contactLists.find((l) => l.id === formData.contactListId)?.name || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>SEND RATE</div>
                  <div>{formData.sendRatePerHour} emails/hour</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>FOLLOW-UPS</div>
                  <div>{followUps.length} steps</div>
                </div>
              </div>

              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>EMAIL PREVIEW</div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap', fontSize: 'var(--text-sm)', lineHeight: '1.8' }}>
                  {formData.bodyText || 'No email body set'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xl)' }}>
          <button type="button" className="btn btn-secondary"
            onClick={() => step > 1 ? setStep(step - 1) : router.push('/campaigns')}
          >
            {step === 1 ? '← Back to Campaigns' : '← Previous'}
          </button>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {step < 4 ? (
              <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                Next →
              </button>
            ) : (
              <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                {saving ? <><span className="spinner" /> Creating...</> : '🚀 Create Campaign'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
