'use client';

import { useState } from 'react';

type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  createdAt: string;
};

export default function AdminClient({ initialPending }: { initialPending: Server[] }) {
  const [servers, setServers] = useState<Server[]>(initialPending);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setLoadingId(id);
    setError('');

    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || 'Action failed');
      }

      // Remove the item from the list
      setServers((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '1rem' }}>Name</th>
              <th style={{ padding: '1rem' }}>URL</th>
              <th style={{ padding: '1rem' }}>Submitted</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {servers.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No pending submissions!
                </td>
              </tr>
            ) : (
              servers.map((server) => (
                <tr key={server.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}>
                    <strong>{server.name}</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {server.description}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <a href={server.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>Link</a>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {new Date(server.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleAction(server.id, 'approve')}
                        disabled={loadingId === server.id}
                        style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: loadingId === server.id ? 0.5 : 1 }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(server.id, 'reject')}
                        disabled={loadingId === server.id}
                        style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: loadingId === server.id ? 0.5 : 1 }}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
