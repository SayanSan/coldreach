'use client';

import { useEffect, useState } from 'react';

interface Lead {
  id: string;
  sentiment: string;
  leadScore: string;
  aiSummary: string | null;
  replyBody: string | null;
  stage: string;
  notes: string | null;
  createdAt: string;
  contact: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    title: string | null;
  };
  campaignEmail: {
    personalizedSubject: string | null;
    campaign: { name: string };
  };
}

const STAGES = ['NEW', 'REPLIED', 'INTERESTED', 'QUALIFIED', 'CONVERTED', 'LOST'];

const STAGE_COLORS: Record<string, string> = {
  NEW: 'var(--accent)',
  REPLIED: 'var(--info)',
  INTERESTED: 'var(--warning)',
  QUALIFIED: 'var(--success)',
  CONVERTED: 'hsl(270, 80%, 65%)',
  LOST: 'var(--danger)',
};

const SCORE_BADGE: Record<string, string> = {
  HOT: 'badge-red',
  WARM: 'badge-orange',
  COLD: 'badge-blue',
};

const SENTIMENT_EMOJI: Record<string, string> = {
  POSITIVE: '😊',
  NEUTRAL: '😐',
  NEGATIVE: '😟',
  OUT_OF_OFFICE: '🏖️',
  UNSUBSCRIBE: '🚫',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStage = async (leadId: string, stage: string) => {
    try {
      await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, stage }),
      });
      setLeads(leads.map((l) => l.id === leadId ? { ...l, stage } : l));
    } catch (error) {
      console.error('Failed to update lead:', error);
    }
  };

  const getLeadsByStage = (stage: string) => leads.filter((l) => l.stage === stage);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Lead Pipeline</h1>
            <p className="page-subtitle">Track and manage your leads</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ width: '300px', height: '400px', borderRadius: '14px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lead Pipeline</h1>
          <p className="page-subtitle">{leads.length} total leads</p>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">⚡</div>
            <h3 className="empty-state-title">No leads yet</h3>
            <p className="empty-state-description">
              Leads will appear here automatically when contacts reply to your campaigns.
              The AI will classify replies and create leads.
            </p>
          </div>
        </div>
      ) : (
        <div className="kanban-board">
          {STAGES.map((stage) => {
            const stageLeads = getLeadsByStage(stage);
            return (
              <div key={stage} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: STAGE_COLORS[stage], display: 'inline-block',
                    }} />
                    {stage}
                  </div>
                  <span className="kanban-column-count">{stageLeads.length}</span>
                </div>
                <div className="kanban-column-body">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="kanban-card"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div className="kanban-card-name">
                        {lead.contact.firstName || lead.contact.lastName
                          ? `${lead.contact.firstName || ''} ${lead.contact.lastName || ''}`.trim()
                          : lead.contact.email}
                      </div>
                      <div className="kanban-card-company">
                        {lead.contact.company || lead.contact.email}
                      </div>
                      {lead.aiSummary && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)', lineHeight: '1.4' }}>
                          {lead.aiSummary}
                        </div>
                      )}
                      <div className="kanban-card-footer">
                        <span className={`badge ${SCORE_BADGE[lead.leadScore] || 'badge-gray'}`}>
                          {lead.leadScore}
                        </span>
                        <span style={{ fontSize: '16px' }}>
                          {SENTIMENT_EMOJI[lead.sentiment] || '😐'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="modal-backdrop" onClick={() => setSelectedLead(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {selectedLead.contact.firstName || selectedLead.contact.lastName
                  ? `${selectedLead.contact.firstName || ''} ${selectedLead.contact.lastName || ''}`.trim()
                  : selectedLead.contact.email}
              </h2>
              <button className="modal-close" onClick={() => setSelectedLead(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>SENTIMENT</div>
                  <span style={{ fontSize: '20px' }}>{SENTIMENT_EMOJI[selectedLead.sentiment]}</span>
                  <span style={{ marginLeft: '8px', fontWeight: 500 }}>{selectedLead.sentiment}</span>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>LEAD SCORE</div>
                  <span className={`badge ${SCORE_BADGE[selectedLead.leadScore]}`}>{selectedLead.leadScore}</span>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>CAMPAIGN</div>
                  <span style={{ fontSize: 'var(--text-sm)' }}>{selectedLead.campaignEmail.campaign.name}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>EMAIL</div>
                  <div>{selectedLead.contact.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>COMPANY</div>
                  <div>{selectedLead.contact.company || '—'}</div>
                </div>
              </div>

              {selectedLead.aiSummary && (
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>AI SUMMARY</div>
                  <div style={{
                    background: 'var(--accent-muted)', borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-md)', fontSize: 'var(--text-sm)', color: 'var(--accent)',
                  }}>
                    💡 {selectedLead.aiSummary}
                  </div>
                </div>
              )}

              {selectedLead.replyBody && (
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>REPLY</div>
                  <div style={{
                    background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-md)', fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap',
                    maxHeight: '200px', overflow: 'auto',
                  }}>
                    {selectedLead.replyBody}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>MOVE TO STAGE</div>
                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                  {STAGES.map((stage) => (
                    <button
                      key={stage}
                      className={`btn btn-sm ${selectedLead.stage === stage ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        updateLeadStage(selectedLead.id, stage);
                        setSelectedLead({ ...selectedLead, stage });
                      }}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
