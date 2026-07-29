'use client';

import { useState } from 'react';
import { toast } from '../../components/ui/Toast';
import { parsePendingRevision } from '../../lib/pendingRevision';
import { notifyAdminStatsChanged } from '../../lib/adminStatsRefresh';
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
  pendingLogoKey?: string | null;
};

export default function AdminClient({
  initialPending,
  initialPendingEdits = [],
  initialPendingClaims = [],
  initialPendingLogos = [],
}: {
  initialPending: Server[];
  initialPendingEdits?: Server[];
  initialPendingClaims?: Server[];
  initialPendingLogos?: Server[];
}) {
  const [pending, setPending] = useState<Server[]>(initialPending);
  const [pendingEdits, setPendingEdits] = useState<Server[]>(initialPendingEdits);
  const [pendingClaims, setPendingClaims] = useState<Server[]>(initialPendingClaims);
  const [pendingLogos, setPendingLogos] = useState<Server[]>(initialPendingLogos);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (
    id: string,
    action: 'approve' | 'reject' | 'approve_edit' | 'reject_edit' | 'approve_claim' | 'reject_claim' | 'approve_logo' | 'reject_logo'
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
        notifyAdminStatsChanged();
      } else if (action === 'approve_edit' || action === 'reject_edit') {
        setPendingEdits((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve_edit' ? 'Edit approved' : 'Edit rejected');
      } else if (action === 'approve_claim' || action === 'reject_claim') {
        setPendingClaims((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve_claim' ? 'Claim approved' : 'Claim rejected');
      } else {
        setPendingLogos((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve_logo' ? 'Logo approved' : 'Logo rejected');
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
    <div className="admin-shell">
      <section>
        <h2 className="admin-section-title">Pending submissions</h2>
        <ServerTable
          servers={pending}
          empty="No pending submissions!"
          loadingId={loadingId}
          onAction={(id, action) => handleAction(id, action)}
        />
      </section>

      <section>
        <h2 className="admin-section-title">Pending edits</h2>
        <p className="admin-section-desc">
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
        <h2 className="admin-section-title">Pending claims</h2>
        <p className="admin-section-desc">
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
        <h2 className="admin-section-title">Pending logos</h2>
        <p className="admin-section-desc">
          Owner-uploaded logos awaiting approval. Nothing here is public until approved.
        </p>
        <PendingLogosTable
          servers={pendingLogos}
          loadingId={loadingId}
          onApprove={(id) => handleAction(id, 'approve_logo')}
          onReject={(id) => handleAction(id, 'reject_logo')}
        />
      </section>

      <section>
        <h2 className="admin-section-title">Manage listings</h2>
        <p className="admin-section-desc">
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
    <div className="admin-card">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Links</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <tr>
              <td colSpan={4} className="admin-table-empty">
                {empty}
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr key={server.id}>
                <td data-label="Name">
                  <strong>{server.name}</strong>
                  {server.reviewPriority && (
                    <span className="admin-badge" style={{ color: '#fbbf24' }}>
                      PRIORITY
                    </span>
                  )}
                  {server.isPremium && (
                    <span className="admin-badge" style={{ color: '#00E5FF' }}>
                      PREMIUM
                    </span>
                  )}
                  <div className="admin-desc-line">{server.description}</div>
                </td>
                <td data-label="Links">
                  <div className="admin-links-cell">
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
                <td data-label="Submitted" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(server.createdAt).toLocaleDateString()}
                </td>
                <td data-label="Actions">
                  <div className="admin-actions">
                    <button
                      onClick={() => onAction(server.id, 'approve')}
                      disabled={loadingId === server.id}
                      className="admin-btn"
                      style={{ background: '#047857' }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onAction(server.id, 'reject')}
                      disabled={loadingId === server.id}
                      className="admin-btn"
                      style={{ background: '#b91c1c' }}
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
    <div className="admin-card">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Listing</th>
            <th>Proposed changes</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <tr>
              <td colSpan={4} className="admin-table-empty">
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
                <tr key={server.id}>
                  <td data-label="Listing">
                    <strong>{server.name}</strong>
                  </td>
                  <td data-label="Proposed changes">
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
                  <td data-label="Submitted" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(pending.submittedAt).toLocaleDateString()}
                  </td>
                  <td data-label="Actions">
                    <div className="admin-actions">
                      <button
                        onClick={() => onApprove(server.id)}
                        disabled={loadingId === server.id}
                        className="admin-btn"
                        style={{ background: '#047857' }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onReject(server.id)}
                        disabled={loadingId === server.id}
                        className="admin-btn"
                        style={{ background: '#b91c1c' }}
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
    <div className="admin-card">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Listing</th>
            <th>Repo</th>
            <th>Proven website</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <tr>
              <td colSpan={4} className="admin-table-empty">
                No pending claims!
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr key={server.id}>
                <td data-label="Listing">
                  <strong>{server.name}</strong>
                </td>
                <td data-label="Repo">
                  <a href={server.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                    Repo
                  </a>
                </td>
                <td data-label="Proven website">
                  {server.pendingClaimWebsiteUrl ? (
                    <a
                      href={server.pendingClaimWebsiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-color)', fontSize: '0.85rem', overflowWrap: 'anywhere' }}
                    >
                      {server.pendingClaimWebsiteUrl}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td data-label="Actions">
                  <div className="admin-actions">
                    <button
                      onClick={() => onApprove(server.id)}
                      disabled={loadingId === server.id}
                      className="admin-btn"
                      style={{ background: '#047857' }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onReject(server.id)}
                      disabled={loadingId === server.id}
                      className="admin-btn"
                      style={{ background: '#b91c1c' }}
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

function PendingLogosTable({
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
    <div className="admin-card">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Listing</th>
            <th>Preview</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <tr>
              <td colSpan={3} className="admin-table-empty">
                No pending logos!
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr key={server.id}>
                <td data-label="Listing">
                  <strong>{server.name}</strong>
                </td>
                <td data-label="Preview">
                  {server.pendingLogoKey && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/admin/logo-preview?key=${encodeURIComponent(server.pendingLogoKey)}`}
                      alt={`${server.name} pending logo`}
                      width={64}
                      height={64}
                      style={{ borderRadius: 8, display: 'block' }}
                    />
                  )}
                </td>
                <td data-label="Actions">
                  <div className="admin-actions">
                    <button
                      onClick={() => onApprove(server.id)}
                      disabled={loadingId === server.id}
                      className="admin-btn"
                      style={{ background: '#047857' }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onReject(server.id)}
                      disabled={loadingId === server.id}
                      className="admin-btn"
                      style={{ background: '#b91c1c' }}
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
