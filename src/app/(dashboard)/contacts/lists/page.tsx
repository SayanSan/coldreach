'use client';

import { useEffect, useState, FormEvent } from 'react';

interface ContactList {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: {
    members: number;
    campaigns: number;
  };
}

export default function ContactListsPage() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editList, setEditList] = useState<ContactList | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => { fetchLists(); }, []);

  const fetchLists = async () => {
    try {
      const res = await fetch('/api/contacts/lists');
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists || []);
      }
    } catch (error) {
      console.error('Failed to fetch lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const method = editList ? 'PUT' : 'POST';
      const body = editList ? { id: editList.id, name, description } : { name, description };
      const res = await fetch('/api/contacts/lists', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowModal(false);
        setEditList(null);
        setName('');
        setDescription('');
        fetchLists();
      }
    } catch (error) {
      console.error('Failed to save list:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this list? Contacts will NOT be deleted.')) return;
    try {
      await fetch(`/api/contacts/lists?id=${id}`, { method: 'DELETE' });
      fetchLists();
    } catch (error) {
      console.error('Failed to delete list:', error);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contact Lists</h1>
          <p className="page-subtitle">Organize contacts into targeted groups</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => { setEditList(null); setName(''); setDescription(''); setShowModal(true); }}>
            + Create List
          </button>
        </div>
      </div>

      {loading ? (
        <div className="stats-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="stat-card"><div className="skeleton skeleton-card" /></div>
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3 className="empty-state-title">No lists yet</h3>
            <p className="empty-state-description">Create lists to organize your contacts for targeted campaigns.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Create List</button>
          </div>
        </div>
      ) : (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {lists.map((list) => (
            <div key={list.id} className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon blue">📋</div>
              </div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)', marginBottom: 'var(--space-xs)' }}>
                {list.name}
              </div>
              {list.description && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                  {list.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                <span>👥 {list._count.members} contacts</span>
                <span>📧 {list._count.campaigns} campaigns</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setEditList(list);
                  setName(list.name);
                  setDescription(list.description || '');
                  setShowModal(true);
                }}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(list.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editList ? 'Edit List' : 'Create List'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">List Name *</label>
                  <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., SaaS Founders Q1" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this list..." rows={3} style={{ minHeight: '80px' }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editList ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
