'use client';

import { useState, type CSSProperties } from 'react';
import { toast } from '@/components/ui/Toast';
import { parsePendingRevision } from '@/lib/pendingRevision';

type Server = {
  id: string;
  name: string;
  description: string;
  category: string;
  websiteUrl?: string | null;
  pendingRevision?: string | null;
};

export default function DashboardClient({ initialServers }: { initialServers: Server[] }) {
  const [servers, setServers] = useState(initialServers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', websiteUrl: '' });
  const [saving, setSaving] = useState(false);

  const startEdit = (server: Server) => {
    setEditingId(server.id);
    setForm({
      name: server.name,
      description: server.description,
      category: server.category,
      websiteUrl: server.websiteUrl || '',
    });
  };

  const submitEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...form }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit edit');
      }
      const submittedAt = new Date().toISOString();
      setServers((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, pendingRevision: JSON.stringify({ proposed: form, submittedAt }) }
            : s
        )
      );
      toast.success('Edit submitted', { description: data.message || 'Awaiting review.' });
      setEditingId(null);
    } catch (err: any) {
      toast.error('Could not submit edit', { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  if (servers.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>You don&apos;t have any claimed listings yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {servers.map((server) => {
        const pending = parsePendingRevision(server.pendingRevision);
        const isEditing = editingId === server.id;
        return (
          <div key={server.id} style={cardStyle}>
            <h3 style={{ marginBottom: '0.25rem' }}>{server.name}</h3>
            {pending && (
              <p style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.75rem' }}>
                Awaiting review since {new Date(pending.submittedAt).toLocaleDateString()}
              </p>
            )}
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Name"
                />
                <textarea
                  className="form-input"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description"
                  rows={4}
                />
                <input
                  className="form-input"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Category"
                />
                <input
                  className="form-input"
                  type="url"
                  value={form.websiteUrl}
                  onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                  placeholder="https://yoursite.com"
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" disabled={saving} onClick={submitEdit}>
                    {saving ? 'Submitting…' : pending ? 'Update pending edit' : 'Submit for review'}
                  </button>
                  <button className="btn btn-secondary" disabled={saving} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{server.description}</p>
                <button className="btn btn-secondary" onClick={() => startEdit(server)}>
                  {pending ? 'Edit pending draft' : 'Edit'}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '1.5rem',
};
