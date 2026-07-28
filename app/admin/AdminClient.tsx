'use client';

import { useState, type CSSProperties } from 'react';
import { toast } from '../../components/ui/Toast';
import { parsePendingRevision } from '../../lib/pendingRevision';
import ManageListings from './ManageListings';

type Server = {
  id: string;
  name: string;
  url: string;
  websiteUrl?: string | null;
  description: string;
  category?: string;
  createdAt: string;
  isPremium?: boolean;
  reviewPriority?: boolean;
  status?: string;
  pendingRevision?: string | null;
  pendingClaimUserId?: string | null;
  pendingClaimWebsiteUrl?: string | null;
};

export default function AdminClient({
  initialPending,
  initialPendingEdits = [],
  initialPendingClaims = [],
}: {
  initialPending: Server[];
  initialPendingEdits?: Server[];
  initialPendingClaims?: Server[];
}) {
  const [pending, setPending] = useState<Server[]>(initialPending);
  const [pendingEdits, setPendingEdits] = useState<Server[]>(initialPendingEdits);
  const [pendingClaims, setPendingClaims] = useState<Server[]>(initialPendingClaims);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (
    id: string,
    action: 'approve' | 'reject' | 'approve_edit' | 'reject_edit' | 'approve_claim' | 'reject_claim'
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
      } else if (action === 'approve_edit' || action === 'reject_edit') {
        setPendingEdits((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve_edit' ? 'Edit approved' : 'Edit rejected');
      } else {
        setPendingClaims((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve_claim' ? 'Claim approved' : 'Claim rejected');
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
          onAction={(id, action) => handleAction(id, action)}
        />
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Pending edits</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Owner-submitted changes awaiting approval. Approving applies them immediately; a changed
          website resets its verification.
        </p>
        <PendingEditsTable
          servers={pendingEdits}
          loadingId={loadingId}
          onApprove={(id) => handleAction(id, 'approve_edit')}
          onReject={(id) => handleAction(id, 'reject_edit')}
        />
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Pending claims</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          A claimant proved control of a website that wasn&apos;t already on file for this listing.
          Check the site actually relates to the project before approving.
        </p>
        <PendingClaimsTable
          servers={pendingClaims}
          loadingId={loadingId}
          onApprove={(id) => handleAction(id, 'approve_claim')}
          onReject={(id) => handleAction(id, 'reject_claim')}
        />
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Manage listings</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Search, edit, publish/unpublish, delete, and grant featured placement. Premium listings get
          a dofollow website backlink; free listings use nofollow.
        </p>
        <ManageListings />
      </section>
    </div>
  );
}

function ServerTable({
  servers,
  empty,
  loadingId,
  onAction,
}: {
  servers: Server[];
  empty: string;
  loadingId: string | null;
  onAction: (id: string, action: 'approve' | 'reject') => void;
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
                    <button
                      onClick={() => onAction(server.id, 'approve')}
                      disabled={loadingId === server.id}
                      style={btnStyle('#047857', loadingId === server.id)}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onAction(server.id, 'reject')}
                      disabled={loadingId === server.id}
                      style={btnStyle('#b91c1c', loadingId === server.id)}
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
  );
}

function PendingEditsTable({
  servers,
  loadingId,
  onApprove,
  onReject,
}: {
  servers: Server[];
  loadingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
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
            <th style={{ padding: '1rem' }}>Listing</th>
            <th style={{ padding: '1rem' }}>Proposed changes</th>
            <th style={{ padding: '1rem' }}>Submitted</th>
            <th style={{ padding: '1rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No pending edits!
              </td>
            </tr>
          ) : (
            servers.map((server) => {
              const pending = parsePendingRevision(server.pendingRevision);
              if (!pending) return null;
              const fields = Object.keys(pending.proposed) as (keyof typeof pending.proposed)[];
              const currentValues: Record<string, string | undefined> = {
                name: server.name,
                description: server.description,
                category: server.category,
                websiteUrl: server.websiteUrl ?? '',
              };
              return (
                <tr key={server.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}>
                    <strong>{server.name}</strong>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {fields.map((field) => (
                      <div key={field} style={{ marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          {field}
                        </div>
                        <div style={{ fontSize: '0.8rem', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                          {currentValues[field] || '(empty)'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#10b981' }}>{pending.proposed[field]}</div>
                      </div>
                    ))}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {new Date(pending.submittedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => onApprove(server.id)}
                        disabled={loadingId === server.id}
                        style={btnStyle('#047857', loadingId === server.id)}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onReject(server.id)}
                        disabled={loadingId === server.id}
                        style={btnStyle('#b91c1c', loadingId === server.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function PendingClaimsTable({
  servers,
  loadingId,
  onApprove,
  onReject,
}: {
  servers: Server[];
  loadingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
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
            <th style={{ padding: '1rem' }}>Listing</th>
            <th style={{ padding: '1rem' }}>Repo</th>
            <th style={{ padding: '1rem' }}>Proven website</th>
            <th style={{ padding: '1rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No pending claims!
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr key={server.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem' }}>
                  <strong>{server.name}</strong>
                </td>
                <td style={{ padding: '1rem' }}>
                  <a href={server.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                    Repo
                  </a>
                </td>
                <td style={{ padding: '1rem' }}>
                  {server.pendingClaimWebsiteUrl ? (
                    <a
                      href={server.pendingClaimWebsiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}
                    >
                      {server.pendingClaimWebsiteUrl}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => onApprove(server.id)}
                      disabled={loadingId === server.id}
                      style={btnStyle('#047857', loadingId === server.id)}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onReject(server.id)}
                      disabled={loadingId === server.id}
                      style={btnStyle('#b91c1c', loadingId === server.id)}
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
