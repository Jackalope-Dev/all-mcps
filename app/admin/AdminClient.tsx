'use client';

import { useState } from 'react';
import { toast } from '../../components/ui/Toast';
import { parsePendingRevision } from '../../lib/pendingRevision';
import { notifyAdminStatsChanged } from '../../lib/adminStatsRefresh';
import type { AdminStats } from '@/lib/adminStats';
import { StatsBar } from './StatsBar';
import ManageListings from './ManageListings';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminSocialQueue } from './AdminSocialQueue';
import { AdminCronsControl } from './AdminCronsControl';
import {
  LayoutDashboard,
  Clock,
  List,
  BarChart3,
  Share2,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

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

type RecentServer = {
  id: string;
  name: string;
  category?: string;
  url: string;
  websiteUrl?: string | null;
  isPremium?: boolean;
  isOfficial?: boolean;
  createdAt: string;
};

export default function AdminClient({
  initialPending,
  initialPendingEdits = [],
  initialPendingClaims = [],
  initialPendingLogos = [],
  recentlyAdded = [],
  stats,
}: {
  initialPending: Server[];
  initialPendingEdits?: Server[];
  initialPendingClaims?: Server[];
  initialPendingLogos?: Server[];
  recentlyAdded?: RecentServer[];
  stats: AdminStats;
}) {
  const [pending, setPending] = useState<Server[]>(initialPending);
  const [pendingEdits, setPendingEdits] = useState<Server[]>(initialPendingEdits);
  const [pendingClaims, setPendingClaims] = useState<Server[]>(initialPendingClaims);
  const [pendingLogos, setPendingLogos] = useState<Server[]>(initialPendingLogos);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const totalPending = pending.length + pendingEdits.length + pendingClaims.length + pendingLogos.length;
  const defaultTab = totalPending > 0 ? 'moderation' : 'overview';

  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'listings' | 'analytics' | 'social' | 'crons'>(defaultTab);
  const [modSubTab, setModSubTab] = useState<'submissions' | 'edits' | 'claims' | 'logos'>('submissions');

  const handleAction = async (
    id: string,
    action:
      | 'approve'
      | 'reject'
      | 'approve_edit'
      | 'reject_edit'
      | 'approve_claim'
      | 'reject_claim'
      | 'approve_logo'
      | 'reject_logo'
      | 'resend_approval'
  ) => {
    setLoadingId(id);

    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });

      const data = (await res.json()) as { error?: string; message?: string };

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
      } else if (action === 'resend_approval') {
        toast.success(data.message || 'Approval email resent');
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

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'moderation',
      label: 'Moderation Queue',
      icon: Clock,
      badge: totalPending > 0 ? totalPending : undefined,
      badgeColor: '#fbbf24',
    },
    { id: 'listings', label: 'Listings Directory', icon: List },
    { id: 'analytics', label: 'Analytics & Logs', icon: BarChart3 },
    { id: 'social', label: 'Social & Twitter', icon: Share2 },
    { id: 'crons', label: 'Crons & System', icon: Cpu },
  ];

  return (
    <div className="admin-shell">
      {/* KPI Stats Deck */}
      <StatsBar initialStats={stats} onSelectTab={(tab: any) => setActiveTab(tab)} />

      {/* Main Responsive Tab Navigation Bar */}
      <nav className="admin-tabs-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`admin-tab-btn ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="admin-tab-badge" style={{ background: item.badgeColor }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h2 className="admin-section-title" style={{ margin: 0 }}>Recently Approved Listings</h2>
                <p className="admin-section-desc" style={{ margin: 0, marginTop: '0.25rem' }}>
                  The most recently added live listings — newest first.
                </p>
              </div>
            </div>
            <RecentlyAddedTable
              servers={recentlyAdded}
              loadingId={loadingId}
              onResendApproval={(id) => handleAction(id, 'resend_approval')}
            />
          </section>

          <section>
            <h2 className="admin-section-title">Site Operations Overview</h2>
            <AdminAnalyticsView stats={stats} />
          </section>
        </div>
      )}

      {/* TAB 2: MODERATION QUEUE */}
      {activeTab === 'moderation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Moderation Sub-Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <button
              onClick={() => setModSubTab('submissions')}
              className={`admin-btn ${modSubTab === 'submissions' ? 'admin-btn-primary' : ''}`}
              style={{
                background: modSubTab === 'submissions' ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.08)',
                color: modSubTab === 'submissions' ? '#ffffff' : 'var(--text-secondary)',
                border: modSubTab === 'submissions' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
              }}
            >
              Submissions ({pending.length})
            </button>
            <button
              onClick={() => setModSubTab('edits')}
              className={`admin-btn ${modSubTab === 'edits' ? 'admin-btn-primary' : ''}`}
              style={{
                background: modSubTab === 'edits' ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.08)',
                color: modSubTab === 'edits' ? '#ffffff' : 'var(--text-secondary)',
                border: modSubTab === 'edits' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
              }}
            >
              Edits ({pendingEdits.length})
            </button>
            <button
              onClick={() => setModSubTab('claims')}
              className={`admin-btn ${modSubTab === 'claims' ? 'admin-btn-primary' : ''}`}
              style={{
                background: modSubTab === 'claims' ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.08)',
                color: modSubTab === 'claims' ? '#ffffff' : 'var(--text-secondary)',
                border: modSubTab === 'claims' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
              }}
            >
              Claims ({pendingClaims.length})
            </button>
            <button
              onClick={() => setModSubTab('logos')}
              className={`admin-btn ${modSubTab === 'logos' ? 'admin-btn-primary' : ''}`}
              style={{
                background: modSubTab === 'logos' ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.08)',
                color: modSubTab === 'logos' ? '#ffffff' : 'var(--text-secondary)',
                border: modSubTab === 'logos' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
              }}
            >
              Logos ({pendingLogos.length})
            </button>
          </div>

          {modSubTab === 'submissions' && (
            <section>
              <h2 className="admin-section-title">Pending Submissions ({pending.length})</h2>
              <ServerTable
                servers={pending}
                empty="No pending submissions in queue!"
                loadingId={loadingId}
                onAction={(id, action) => handleAction(id, action)}
              />
            </section>
          )}

          {modSubTab === 'edits' && (
            <section>
              <h2 className="admin-section-title">Pending Owner Edits ({pendingEdits.length})</h2>
              <p className="admin-section-desc">
                Owner-submitted revisions. Approving applies them immediately.
              </p>
              <PendingEditsTable
                servers={pendingEdits}
                loadingId={loadingId}
                onApprove={(id) => handleAction(id, 'approve_edit')}
                onReject={(id) => handleAction(id, 'reject_edit')}
              />
            </section>
          )}

          {modSubTab === 'claims' && (
            <section>
              <h2 className="admin-section-title">Pending Ownership Claims ({pendingClaims.length})</h2>
              <p className="admin-section-desc">
                Claimants who verified website ownership via DNS or site badge.
              </p>
              <PendingClaimsTable
                servers={pendingClaims}
                loadingId={loadingId}
                onApprove={(id) => handleAction(id, 'approve_claim')}
                onReject={(id) => handleAction(id, 'reject_claim')}
              />
            </section>
          )}

          {modSubTab === 'logos' && (
            <section>
              <h2 className="admin-section-title">Pending Custom Logos ({pendingLogos.length})</h2>
              <p className="admin-section-desc">
                Logos uploaded by verified owners awaiting approval before publication.
              </p>
              <PendingLogosTable
                servers={pendingLogos}
                loadingId={loadingId}
                onApprove={(id) => handleAction(id, 'approve_logo')}
                onReject={(id) => handleAction(id, 'reject_logo')}
              />
            </section>
          )}
        </div>
      )}

      {/* TAB 3: LISTINGS DIRECTORY */}
      {activeTab === 'listings' && (
        <section>
          <div style={{ marginBottom: '1rem' }}>
            <h2 className="admin-section-title">Manage Directory Listings</h2>
            <p className="admin-section-desc">
              Search, filter, edit metadata, adjust status, grant boost placements, or view deep inspector metadata.
            </p>
          </div>
          <ManageListings />
        </section>
      )}

      {/* TAB 4: ANALYTICS & LOGS */}
      {activeTab === 'analytics' && (
        <section>
          <h2 className="admin-section-title">Analytics & Logs</h2>
          <AdminAnalyticsView stats={stats} />
        </section>
      )}

      {/* TAB 5: SOCIAL QUEUE */}
      {activeTab === 'social' && (
        <section>
          <h2 className="admin-section-title">Social & Twitter</h2>
          <AdminSocialQueue />
        </section>
      )}

      {/* TAB 6: CRONS & SYSTEM */}
      {activeTab === 'crons' && (
        <section>
          <h2 className="admin-section-title">Crons & System</h2>
          <AdminCronsControl />
        </section>
      )}
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
            <th>Name & Details</th>
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
                    <span className="admin-badge" style={{ color: '#d97706', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)' }}>
                      PRIORITY
                    </span>
                  )}
                  {server.isPremium && (
                    <span className="admin-badge" style={{ color: '#0284c7', background: 'rgba(2,132,199,0.15)', border: '1px solid rgba(2,132,199,0.4)' }}>
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

function RecentlyAddedTable({
  servers,
  loadingId,
  onResendApproval,
}: {
  servers: RecentServer[];
  loadingId: string | null;
  onResendApproval: (id: string) => void;
}) {
  return (
    <div className="admin-card">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Links</th>
            <th>Added</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <tr>
              <td colSpan={5} className="admin-table-empty">
                No live listings yet.
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr key={server.id}>
                <td data-label="Name">
                  <strong>{server.name}</strong>
                  {server.isPremium && (
                    <span className="admin-badge" style={{ color: '#00E5FF', background: 'rgba(0,229,255,0.1)' }}>
                      PREMIUM
                    </span>
                  )}
                  {server.isOfficial && (
                    <span className="admin-badge" style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)' }}>
                      OFFICIAL
                    </span>
                  )}
                </td>
                <td data-label="Category" style={{ color: 'var(--text-secondary)' }}>
                  {server.category || '—'}
                </td>
                <td data-label="Links">
                  <div className="admin-links-cell">
                    <a
                      href={`/mcp/${server.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}
                    >
                      Listing
                    </a>
                    <a
                      href={server.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}
                    >
                      Repo
                    </a>
                    {server.websiteUrl && (
                      <a
                        href={server.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}
                      >
                        Website
                      </a>
                    )}
                  </div>
                </td>
                <td data-label="Added" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(server.createdAt).toLocaleDateString()}
                </td>
                <td data-label="Actions">
                  <div className="admin-actions">
                    <button
                      onClick={() => onResendApproval(server.id)}
                      disabled={loadingId === server.id}
                      className="admin-btn"
                      style={{ background: '#007BFF' }}
                      title="Re-send the listing-approved email"
                    >
                      Resend approval email
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
