'use client';

import { useEffect, useState, FormEvent, useRef } from 'react';

interface Contact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
  isUnsubscribed: boolean;
  bounceCount: number;
  createdAt: string;
  listMemberships: { list: { id: string; name: string } }[];
}

interface ContactList {
  id: string;
  name: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    company: '',
    title: '',
    listId: '',
  });

  useEffect(() => {
    fetchContacts();
    fetchLists();
  }, [page, search]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        ...(search && { search }),
      });
      const res = await fetch(`/api/contacts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLists = async () => {
    try {
      const res = await fetch('/api/contacts/lists');
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists || []);
      }
    } catch (error) {
      console.error('Failed to fetch lists:', error);
    }
  };

  const handleAddContact = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ email: '', firstName: '', lastName: '', company: '', title: '', listId: '' });
        fetchContacts();
      }
    } catch (error) {
      console.error('Failed to add contact:', error);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = values[i] || '';
        });
        return row;
      });

      setCsvData(rows);
      setShowCsvModal(true);
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async (listId?: string) => {
    try {
      const contacts = csvData.map((row) => ({
        email: row.email || row.email_address || row['e-mail'],
        firstName: row.first_name || row.firstname || row.name?.split(' ')[0],
        lastName: row.last_name || row.lastname || row.name?.split(' ').slice(1).join(' '),
        company: row.company || row.organization,
        title: row.title || row.job_title || row.position,
      }));

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts, listId }),
      });

      if (res.ok) {
        const result = await res.json();
        setImportResult(result);
        fetchContacts();
      }
    } catch (error) {
      console.error('CSV import failed:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
      fetchContacts();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">{total} total contacts</p>
        </div>
        <div className="page-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleCsvUpload}
          />
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
            📄 Import CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Contact
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            placeholder="Search by email, name, or company..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="card-body">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton skeleton-line" style={{ marginBottom: '16px' }} />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3 className="empty-state-title">No contacts found</h3>
            <p className="empty-state-description">
              {search ? 'No contacts match your search.' : 'Upload a CSV file or add contacts manually to get started.'}
            </p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Lists</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.email}</td>
                      <td>
                        {c.firstName || c.lastName
                          ? `${c.firstName || ''} ${c.lastName || ''}`.trim()
                          : '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.company || '—'}</td>
                      <td>
                        {c.listMemberships.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {c.listMemberships.map((m) => (
                              <span key={m.list.id} className="badge badge-blue">
                                {m.list.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {c.isUnsubscribed ? (
                          <span className="badge badge-red">Unsubscribed</span>
                        ) : c.bounceCount > 0 ? (
                          <span className="badge badge-orange">Bounced ({c.bounceCount})</span>
                        ) : (
                          <span className="badge badge-green">Active</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  ←
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                  <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>
                    {p}
                  </button>
                ))}
                <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Contact</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddContact}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input className="form-input" value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input className="form-input" value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Company</label>
                    <input className="form-input" value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input className="form-input" value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                  </div>
                </div>
                {lists.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Add to List</label>
                    <select className="form-select" value={formData.listId}
                      onChange={(e) => setFormData({ ...formData, listId: e.target.value })}>
                      <option value="">No list</option>
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="modal-backdrop" onClick={() => { setShowCsvModal(false); setImportResult(null); }}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Import CSV</h2>
              <button className="modal-close" onClick={() => { setShowCsvModal(false); setImportResult(null); }}>✕</button>
            </div>
            <div className="modal-body">
              {importResult ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                  <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)' }}>✅</div>
                  <h3 style={{ marginBottom: 'var(--space-sm)' }}>Import Complete</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {importResult.created} contacts imported, {importResult.skipped} skipped
                  </p>
                  <button className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }}
                    onClick={() => { setShowCsvModal(false); setImportResult(null); }}>
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                    Preview: {csvData.length} rows detected. Expected columns: email, first_name, last_name, company, title
                  </p>
                  {csvData.length > 0 && (
                    <div className="table-container" style={{ maxHeight: '300px', overflow: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            {Object.keys(csvData[0]).slice(0, 5).map((key) => (
                              <th key={key}>{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.slice(0, 10).map((row, i) => (
                            <tr key={i}>
                              {Object.keys(csvData[0]).slice(0, 5).map((key) => (
                                <td key={key}>{row[key]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {lists.length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Add to List (optional)</label>
                      <select className="form-select" id="csv-list-select">
                        <option value="">No list</option>
                        {lists.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
            {!importResult && (
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowCsvModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => {
                  const listSelect = document.getElementById('csv-list-select') as HTMLSelectElement;
                  handleCsvImport(listSelect?.value || undefined);
                }}>
                  Import {csvData.length} Contacts
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
