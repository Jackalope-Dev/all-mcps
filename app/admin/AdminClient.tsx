'use client';

import { useState, type CSSProperties } from 'react';
import { toast } from '../../components/ui/Toast';

type Server = {
  id: string;
  name: string;
  url: string;
  websiteUrl?: string | null;
  description: string;
  createdAt: string;
  isPremium?: boolean;
  reviewPriority?: boolean;
  status?: string;
};

export default function AdminClient({
  initialPending,
  initialActive = [],
}: {
  initialPending: Server[];
  initialActive?: Server[];
}) {
  const [pending, setPending] = useState<Server[]>(initialPending);
  const [active, setActive] = useState<Server[]>(initialActive);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (
    id: string,
    action: 'approve' | 'reject' | 'set_premium' | 'unset_premium',
    list: 'pending' | 'active' = 'pending'
  ) => {
    setLoadingId(id);

    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || 'Action failed');
      }

      if (action === 'approve' || action === 'reject') {
        setPending((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve' ? 'Listing approved' : 'Listing rejected');
      } else {
        const premium = action === 'set_premium';
        const updater = (prev: Server[]) =>
          prev.map((s) => (s.id === id ? { ...s, isPremium: premium } : s));
        if (list === 'pending') setPending(updater);
        else setActive(updater);
        toast.success(premium ? 'Marked premium (dofollow)' : 'Premium removed (nofollow)');
      }
    } catch (err: any) {
      toast.error('Action failed', {
        description: err?.message || 'Something went wrong.',
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Pending submissions</h2>
        <ServerTable
          servers={pending}
          empty="No pending submissions!"
          loadingId={loadingId}
          showReviewActions
          onAction={(id, action) => handleAction(id, action, 'pending')}
        />
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Active listings (premium)</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Premium listings get a dofollow website backlink. Free listings use nofollow.
        </p>
        <ServerTable
          servers={active}
          empty="No active listings loaded."
          loadingId={loadingId}
          showPremiumActions
          onAction={(id, action) => handleAction(id, action, 'active')}
        />
      </section>
    </div>
  );
}

function ServerTable({
  servers,
  empty,
  loadingId,
  showReviewActions,
  showPremiumActions,
  onAction,
}: {
  servers: Server[];
  empty: string;
  loadingId: string | null;
  showReviewActions?: boolean;
  showPremiumActions?: boolean;
  onAction: (id: string, action: 'approve' | 'reject' | 'set_premium' | 'unset_premium') => void;
}) {
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
            <th style={{ padding: '1rem' }}>Name</th>
            <th style={{ padding: '1rem' }}>Links</th>
            <th style={{ padding: '1rem' }}>Submitted</th>
            <th style={{ padding: '1rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                {empty}
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr key={server.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem' }}>
                  <strong>{server.name}</strong>
                  {server.reviewPriority && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#fbbf24', fontWeight: 700 }}>
                      PRIORITY
                    </span>
                  )}
                  {server.isPremium && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#00E5FF', fontWeight: 700 }}>
                      PREMIUM
                    </span>
                  )}
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.25rem',
                      maxWidth: '300px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {server.description}
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <a href={server.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                      Repo
                    </a>
                    {server.websiteUrl && (
                      <a href={server.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                        Website
                      </a>
                    )}
                  </div>
                </td>
                <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                  {new Date(server.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {showReviewActions && (
                      <>
                        <button
                          onClick={() => onAction(server.id, 'approve')}
                          disabled={loadingId === server.id}
                          style={btnStyle('#10b981', loadingId === server.id)}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onAction(server.id, 'reject')}
                          disabled={loadingId === server.id}
                          style={btnStyle('#ef4444', loadingId === server.id)}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {showPremiumActions && (
                      <button
                        onClick={() => onAction(server.id, server.isPremium ? 'unset_premium' : 'set_premium')}
                        disabled={loadingId === server.id}
                        style={btnStyle(server.isPremium ? '#64748b' : '#007BFF', loadingId === server.id)}
                      >
                        {server.isPremium ? 'Remove premium' : 'Make premium'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function btnStyle(bg: string, disabled: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: bg,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontSize: '0.85rem',
    fontWeight: 600,
  };
}
