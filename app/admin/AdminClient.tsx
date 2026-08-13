'use client';

import { useState } from 'react';
import { toast } from '../../components/ui/Toast';
import { parsePendingRevision } from '../../lib/pendingRevision';
import { notifyAdminStatsChanged } from '../../lib/adminStatsRefresh';
import type { AdminStats } from '@/lib/adminStats';
import { StatsBar, type KpiCardSelection } from './StatsBar';
import ManageListings, { type ListingFilters } from './ManageListings';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminSocialQueue } from './AdminSocialQueue';
import { AdminToolsControl } from './AdminCronsControl';
import {
  LayoutDashboard,
  Clock,
  List,
  BarChart3,
  Share2,
  Cpu,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  Mail,
  X,
} from 'lucide-react';

type Server = {
  id: string;
  name: string;
  url: string;
  websiteUrl?: string | null;
  submitterEmail?: string | null;
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
  pendingScreenshotKey?: string | null;
  tags?: string[] | string | null;
  pricingModel?: string | null;
  pricingNotes?: string | null;
  authType?: string | null;
  license?: string | null;
  compatibleClients?: string[] | string | null;
  maintenanceStatus?: string | null;
  supportUrl?: string | null;
  suggestedInstallCommand?: string | null;
  suggestedInstallArgs?: string[] | string | null;
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

type ReportItem = {
  id: number;
  serverId: string;
  serverName?: string | null;
  reason: string;
  details?: string | null;
  status: string;
  createdAt: string;
};

const REPORT_REASON_LABELS: Record<string, string> = {
  broken_install: "Install doesn't work",
  misleading: 'Misleading or inaccurate info',
  malicious: 'Malicious or unsafe behavior',
  dead_link: 'Dead link / repo gone',
  other: 'Something else',
};

type ReviewCommentItem = {
  id: number;
  serverId: string;
  serverName?: string | null;
  reviewerEmail?: string | null;
  rating: number;
  comment?: string | null;
  createdAt: string;
};

export default function AdminClient({
  initialPending,
  initialPendingEdits = [],
  initialPendingClaims = [],
  initialPendingLogos = [],
  initialPendingScreenshots = [],
  initialOpenReports = [],
  initialPendingReviewComments = [],
  recentlyAdded = [],
  stats,
}: {
  initialPending: Server[];
  initialPendingEdits?: Server[];
  initialPendingClaims?: Server[];
  initialPendingLogos?: Server[];
  initialPendingScreenshots?: Server[];
  initialOpenReports?: ReportItem[];
  initialPendingReviewComments?: ReviewCommentItem[];
  recentlyAdded?: RecentServer[];
  stats: AdminStats;
}) {
  const [pending, setPending] = useState<Server[]>(initialPending);
  const [pendingEdits, setPendingEdits] = useState<Server[]>(initialPendingEdits);
  const [pendingClaims, setPendingClaims] = useState<Server[]>(initialPendingClaims);
  const [pendingLogos, setPendingLogos] = useState<Server[]>(initialPendingLogos);
  const [pendingScreenshots, setPendingScreenshots] = useState<Server[]>(initialPendingScreenshots);
  const [openReports, setOpenReports] = useState<ReportItem[]>(initialOpenReports);
  const [pendingReviewComments, setPendingReviewComments] = useState<ReviewCommentItem[]>(initialPendingReviewComments);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Rejection Reason Modal State
  const [rejectingItem, setRejectingItem] = useState<{
    id: string;
    name: string;
    action: 'reject' | 'reject_edit' | 'reject_claim' | 'reject_logo' | 'reject_screenshot' | 'reject_review_comment';
    submitterEmail?: string | null;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const totalPending =
    pending.length +
    pendingEdits.length +
    pendingClaims.length +
    pendingLogos.length +
    pendingScreenshots.length +
    pendingReviewComments.length;
  const defaultTab = totalPending > 0 ? 'moderation' : 'listings';
  const [activeTab, setActiveTab] = useState<
    'overview' | 'moderation' | 'listings' | 'analytics' | 'social' | 'crons' | 'tools'
  >(defaultTab);
  const [modSubTab, setModSubTab] = useState<
    'submissions' | 'edits' | 'claims' | 'logos' | 'screenshots' | 'reviews' | 'reports'
  >('submissions');
  const [activeListingsFilters, setActiveListingsFilters] = useState<ListingFilters | undefined>(undefined);

  const handleKpiCardSelect = (selection: KpiCardSelection) => {
    const targetTab = (selection.tab as string) === 'overview' ? 'listings' : selection.tab;
    setActiveTab(targetTab as any);
    if (selection.filters) {
      setActiveListingsFilters(selection.filters);
    }
  };

  const openRejectModal = (
    id: string,
    name: string,
    action: 'reject' | 'reject_edit' | 'reject_claim' | 'reject_logo' | 'reject_screenshot' | 'reject_review_comment',
    submitterEmail?: string | null
  ) => {
    setRejectingItem({ id, name, action, submitterEmail });
    setRejectionReason(
      action === 'reject_review_comment'
        ? "Your written comment wasn't approved for public display. Your star rating still counts as-is — only the comment text was affected."
        : 'Your submission was not approved because the details or repository information were incomplete. You are welcome to update your information and submit again.'
    );
  };

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
      | 'approve_screenshot'
      | 'reject_screenshot'
      | 'resend_approval'
      | 'mark_report_reviewed'
      | 'dismiss_report'
      | 'approve_review_comment'
      | 'reject_review_comment'
      | 'delete_review',
    extra?: { reason?: string }
  ) => {
    setLoadingId(id);

    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });

      const data = (await res.json()) as { error?: string; message?: string };

      if (!res.ok) {
        throw new Error(data.error || 'Action failed');
      }

      if (action === 'approve' || action === 'reject') {
        setPending((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve' ? 'Listing approved' : 'Listing rejected & submitter notified');
        notifyAdminStatsChanged();
      } else if (action === 'approve_edit' || action === 'reject_edit') {
        setPendingEdits((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve_edit' ? 'Edit approved' : 'Edit rejected');
      } else if (action === 'approve_claim' || action === 'reject_claim') {
        setPendingClaims((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve_claim' ? 'Claim approved' : 'Claim rejected');
      } else if (action === 'approve_screenshot' || action === 'reject_screenshot') {
        setPendingScreenshots((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve_screenshot' ? 'Screenshot approved' : 'Screenshot rejected');
      } else if (action === 'resend_approval') {
        toast.success(data.message || 'Approval email resent');
      } else if (action === 'mark_report_reviewed' || action === 'dismiss_report') {
        setOpenReports((prev) => prev.filter((r) => String(r.id) !== id));
        toast.success(action === 'mark_report_reviewed' ? 'Report marked reviewed' : 'Report dismissed');
      } else if (
        action === 'approve_review_comment' ||
        action === 'reject_review_comment' ||
        action === 'delete_review'
      ) {
        setPendingReviewComments((prev) => prev.filter((r) => String(r.id) !== id));
        toast.success(
          action === 'approve_review_comment'
            ? 'Comment approved'
            : action === 'reject_review_comment'
              ? 'Comment rejected'
              : 'Review deleted'
        );
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
    {
      id: 'moderation',
      label: 'Moderation Queue',
      icon: Clock,
      badge: totalPending > 0 ? totalPending : undefined,
      badgeColor: '#d97706',
    },
    { id: 'listings', label: 'Listings Directory', icon: List },
    { id: 'analytics', label: 'Analytics & Logs', icon: BarChart3 },
    { id: 'social', label: 'Social & Twitter', icon: Share2 },
    { id: 'tools', label: 'Admin Tools & Actions', icon: Wrench },
  ];

  return (
    <div className="admin-shell">
      {/* KPI Stats Deck */}
      <StatsBar
        initialStats={stats}
        onSelectCard={handleKpiCardSelect}
        onSelectTab={(tab: any) => setActiveTab(tab)}
      />

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
            <button
              onClick={() => setModSubTab('screenshots')}
              className={`admin-btn ${modSubTab === 'screenshots' ? 'admin-btn-primary' : ''}`}
              style={{
                background: modSubTab === 'screenshots' ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.08)',
                color: modSubTab === 'screenshots' ? '#ffffff' : 'var(--text-secondary)',
                border: modSubTab === 'screenshots' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
              }}
            >
              Screenshots ({pendingScreenshots.length})
            </button>
            <button
              onClick={() => setModSubTab('reviews')}
              className={`admin-btn ${modSubTab === 'reviews' ? 'admin-btn-primary' : ''}`}
              style={{
                background: modSubTab === 'reviews' ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.08)',
                color: modSubTab === 'reviews' ? '#ffffff' : 'var(--text-secondary)',
                border: modSubTab === 'reviews' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
              }}
            >
              Review Comments ({pendingReviewComments.length})
            </button>
            <button
              onClick={() => setModSubTab('reports')}
              className={`admin-btn ${modSubTab === 'reports' ? 'admin-btn-primary' : ''}`}
              style={{
                background: modSubTab === 'reports' ? 'var(--accent-color)' : 'rgba(128, 128, 128, 0.08)',
                color: modSubTab === 'reports' ? '#ffffff' : 'var(--text-secondary)',
                border: modSubTab === 'reports' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
              }}
            >
              Reports ({openReports.length})
            </button>
          </div>

          {modSubTab === 'submissions' && (
            <section>
              <h2 className="admin-section-title">Pending Submissions ({pending.length})</h2>
              <ServerTable
                servers={pending}
                empty="No pending submissions in queue!"
                loadingId={loadingId}
                onApprove={(id) => handleAction(id, 'approve')}
                onReject={(server) => openRejectModal(server.id, server.name, 'reject', server.submitterEmail)}
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
                onReject={(server) => openRejectModal(server.id, server.name, 'reject_edit')}
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
                onReject={(server) => openRejectModal(server.id, server.name, 'reject_claim')}
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
                onReject={(server) => openRejectModal(server.id, server.name, 'reject_logo')}
              />
            </section>
          )}

          {modSubTab === 'screenshots' && (
            <section>
              <h2 className="admin-section-title">Pending Screenshots ({pendingScreenshots.length})</h2>
              <p className="admin-section-desc">
                Screenshots uploaded by verified owners awaiting approval before publication.
              </p>
              <PendingScreenshotsTable
                servers={pendingScreenshots}
                loadingId={loadingId}
                onApprove={(id) => handleAction(id, 'approve_screenshot')}
                onReject={(server) => openRejectModal(server.id, server.name, 'reject_screenshot')}
              />
            </section>
          )}

          {modSubTab === 'reviews' && (
            <section>
              <h2 className="admin-section-title">Pending Review Comments ({pendingReviewComments.length})</h2>
              <p className="admin-section-desc">
                Star ratings publish immediately and aren&rsquo;t gated here — only the written comment text needs approval before it&rsquo;s shown publicly.
              </p>
              <PendingReviewsTable
                reviews={pendingReviewComments}
                loadingId={loadingId}
                onApprove={(id) => handleAction(String(id), 'approve_review_comment')}
                onReject={(review) =>
                  openRejectModal(String(review.id), review.serverName || review.serverId, 'reject_review_comment')
                }
                onDelete={(id) => handleAction(String(id), 'delete_review')}
              />
            </section>
          )}

          {modSubTab === 'reports' && (
            <section>
              <h2 className="admin-section-title">Open Reports ({openReports.length})</h2>
              <p className="admin-section-desc">
                Visitor-flagged problems, triage-only — never directly affects a listing&rsquo;s public score. Act on the listing itself (edit/unpublish) via Manage Listings if a report is valid.
              </p>
              <PendingReportsTable
                reports={openReports}
                loadingId={loadingId}
                onReviewed={(id) => handleAction(String(id), 'mark_report_reviewed')}
                onDismiss={(id) => handleAction(String(id), 'dismiss_report')}
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
          <ManageListings initialFilters={activeListingsFilters} />
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

      {/* TAB 6: ADMIN TOOLS & UTILITIES */}
      {(activeTab === 'tools' || (activeTab as string) === 'crons') && (
        <section>
          <h2 className="admin-section-title">Admin Tools & Maintenance Utilities</h2>
          <AdminToolsControl />
        </section>
      )}

      {/* Rejection Reason & Email Modal */}
      {rejectingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="admin-card"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Reject & Send Feedback
              </h3>
              <button
                onClick={() => setRejectingItem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Rejecting: <strong style={{ color: 'var(--text-primary)' }}>{rejectingItem.name}</strong>
              {rejectingItem.submitterEmail ? (
                <div style={{ marginTop: '0.35rem', color: 'var(--text-primary)' }}>
                  Notification email will be sent to: <strong>{rejectingItem.submitterEmail}</strong>
                </div>
              ) : (
                <div style={{ marginTop: '0.35rem', fontStyle: 'italic' }}>
                  No submitter email attached (anonymous submission).
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Rejection Reason / Feedback to Submitter:
              </label>
              <textarea
                className="form-input"
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason or instructions..."
                style={{ width: '100%', fontSize: '0.85rem', lineHeight: 1.4 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setRejectingItem(null)}
                className="admin-btn"
                style={{ background: 'rgba(128, 128, 128, 0.15)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleAction(rejectingItem.id, rejectingItem.action, { reason: rejectionReason.trim() });
                  setRejectingItem(null);
                }}
                disabled={loadingId === rejectingItem.id}
                className="admin-btn"
                style={{ background: '#b91c1c', color: '#ffffff' }}
              >
                Confirm Rejection & Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServerTable({
  servers,
  empty,
  loadingId,
  onApprove,
  onReject,
}: {
  servers: Server[];
  empty: string;
  loadingId: string | null;
  onApprove: (id: string) => void;
  onReject: (server: Server) => void;
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
            servers.map((server) => {
              const tagsList = Array.isArray(server.tags)
                ? server.tags
                : typeof server.tags === 'string'
                  ? JSON.parse(server.tags || '[]')
                  : [];
              const clientsList = Array.isArray(server.compatibleClients)
                ? server.compatibleClients
                : typeof server.compatibleClients === 'string'
                  ? JSON.parse(server.compatibleClients || '[]')
                  : [];
              const hasExtra =
                tagsList.length > 0 ||
                Boolean(server.pricingModel) ||
                Boolean(server.authType) ||
                Boolean(server.license) ||
                Boolean(server.maintenanceStatus) ||
                Boolean(server.supportUrl) ||
                clientsList.length > 0 ||
                Boolean(server.suggestedInstallCommand);

              return (
                <tr key={server.id}>
                  <td data-label="Name">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <strong>{server.name}</strong>
                      {server.reviewPriority && (
                        <span className="admin-badge admin-badge-priority">
                          PRIORITY
                        </span>
                      )}
                      {server.isPremium && (
                        <span className="admin-badge admin-badge-premium">
                          PREMIUM
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      <Mail size={13} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                      <span>Submitter:</span>
                      {server.submitterEmail ? (
                        <strong style={{ color: 'var(--text-primary)' }}>{server.submitterEmail}</strong>
                      ) : (
                        <span style={{ fontStyle: 'italic', opacity: 0.8 }}>Anonymous</span>
                      )}
                    </div>

                    <div className="admin-desc-line">{server.description}</div>

                    {hasExtra && (
                      <details style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <summary style={{ cursor: 'pointer', color: 'var(--accent-color)', fontWeight: 600 }}>
                          Extra details (pricing, auth, license…)
                        </summary>
                        <div
                          style={{
                            marginTop: '0.4rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            background: 'var(--bg-muted)',
                            border: '1px solid var(--border-color)',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                          }}
                        >
                          {tagsList.length > 0 && <div>Tags: {tagsList.join(', ')}</div>}
                          {server.pricingModel && (
                            <div>
                              Pricing: {server.pricingModel}
                              {server.pricingNotes ? ` (${server.pricingNotes})` : ''}
                            </div>
                          )}
                          {server.authType && <div>Auth: {server.authType}</div>}
                          {server.license && <div>License: {server.license}</div>}
                          {server.maintenanceStatus && <div>Maintenance: {server.maintenanceStatus}</div>}
                          {clientsList.length > 0 && <div>Compatible clients: {clientsList.join(', ')}</div>}
                          {server.supportUrl && <div>Support: {server.supportUrl}</div>}
                          {server.suggestedInstallCommand && (
                            <div>
                              Install hint: {server.suggestedInstallCommand}{' '}
                              {Array.isArray(server.suggestedInstallArgs)
                                ? server.suggestedInstallArgs.join(' ')
                                : server.suggestedInstallArgs || ''}
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </td>
                  <td data-label="Links">
                    <div className="admin-links-cell">
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
                  <td data-label="Submitted" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(server.createdAt).toLocaleDateString()}
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
                        onClick={() => onReject(server)}
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
  onReject: (server: Server) => void;
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
              const serverRow = server as Record<string, unknown>;
              const formatVal = (v: unknown): string => {
                if (v == null || v === '') return '(empty)';
                if (Array.isArray(v)) return v.length ? v.join(', ') : '(empty)';
                return String(v);
              };
              return (
                <tr key={server.id}>
                  <td data-label="Listing">
                    <strong>{server.name}</strong>
                  </td>
                  <td data-label="Proposed changes">
                    {fields.map((field) => {
                      const currentRaw = serverRow[field as string];
                      return (
                        <div key={field} style={{ marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            {field}
                          </div>
                          <div style={{ fontSize: '0.8rem', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                            {formatVal(currentRaw)}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#10b981' }}>
                            {formatVal(pending.proposed[field])}
                          </div>
                        </div>
                      );
                    })}
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
                        onClick={() => onReject(server)}
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
  onReject: (server: Server) => void;
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
                      onClick={() => onReject(server)}
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
  onReject: (server: Server) => void;
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
                      onClick={() => onReject(server)}
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

function PendingScreenshotsTable({
  servers,
  loadingId,
  onApprove,
  onReject,
}: {
  servers: Server[];
  loadingId: string | null;
  onApprove: (id: string) => void;
  onReject: (server: Server) => void;
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
                No pending screenshots!
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr key={server.id}>
                <td data-label="Listing">
                  <strong>{server.name}</strong>
                </td>
                <td data-label="Preview">
                  {server.pendingScreenshotKey && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/admin/logo-preview?key=${encodeURIComponent(server.pendingScreenshotKey)}`}
                      alt={`${server.name} pending screenshot`}
                      width={120}
                      height={70}
                      style={{ borderRadius: 8, display: 'block', objectFit: 'cover' }}
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
                      onClick={() => onReject(server)}
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

function PendingReportsTable({
  reports,
  loadingId,
  onReviewed,
  onDismiss,
}: {
  reports: ReportItem[];
  loadingId: string | null;
  onReviewed: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="admin-card">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Listing</th>
            <th>Reason</th>
            <th>Details</th>
            <th>Reported</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan={5} className="admin-table-empty">
                No open reports!
              </td>
            </tr>
          ) : (
            reports.map((r) => (
              <tr key={r.id}>
                <td data-label="Listing">
                  {r.serverName ? (
                    <a
                      href={`/mcp/${r.serverId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      <strong>{r.serverName}</strong>
                    </a>
                  ) : (
                    <span style={{ fontStyle: 'italic', opacity: 0.8 }}>{r.serverId} (removed)</span>
                  )}
                </td>
                <td data-label="Reason">{REPORT_REASON_LABELS[r.reason] || r.reason}</td>
                <td data-label="Details" style={{ maxWidth: 280 }}>
                  {r.details ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.details}</span>
                  ) : (
                    <span style={{ opacity: 0.6 }}>—</span>
                  )}
                </td>
                <td data-label="Reported">
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </td>
                <td data-label="Actions">
                  <div className="admin-actions">
                    <button
                      onClick={() => onReviewed(r.id)}
                      disabled={loadingId === String(r.id)}
                      className="admin-btn"
                      style={{ background: '#047857' }}
                    >
                      Mark Reviewed
                    </button>
                    <button
                      onClick={() => onDismiss(r.id)}
                      disabled={loadingId === String(r.id)}
                      className="admin-btn"
                      style={{ background: 'rgba(128, 128, 128, 0.3)' }}
                    >
                      Dismiss
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

function PendingReviewsTable({
  reviews,
  loadingId,
  onApprove,
  onReject,
  onDelete,
}: {
  reviews: ReviewCommentItem[];
  loadingId: string | null;
  onApprove: (id: number) => void;
  onReject: (review: ReviewCommentItem) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="admin-card">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Listing</th>
            <th>Reviewer</th>
            <th>Rating</th>
            <th>Comment</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reviews.length === 0 ? (
            <tr>
              <td colSpan={5} className="admin-table-empty">
                No pending review comments!
              </td>
            </tr>
          ) : (
            reviews.map((r) => (
              <tr key={r.id}>
                <td data-label="Listing">
                  {r.serverName ? (
                    <a
                      href={`/mcp/${r.serverId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      <strong>{r.serverName}</strong>
                    </a>
                  ) : (
                    <span style={{ fontStyle: 'italic', opacity: 0.8 }}>{r.serverId} (removed)</span>
                  )}
                </td>
                <td data-label="Reviewer">
                  <span style={{ fontSize: '0.85rem' }}>{r.reviewerEmail || 'Unknown'}</span>
                </td>
                <td data-label="Rating">
                  <span style={{ fontSize: '0.85rem' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </td>
                <td data-label="Comment" style={{ maxWidth: 300 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.comment}</span>
                </td>
                <td data-label="Actions">
                  <div className="admin-actions">
                    <button
                      onClick={() => onApprove(r.id)}
                      disabled={loadingId === String(r.id)}
                      className="admin-btn"
                      style={{ background: '#047857' }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onReject(r)}
                      disabled={loadingId === String(r.id)}
                      className="admin-btn"
                      style={{ background: '#b91c1c' }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Permanently delete this review (rating and comment)? This is for spam/abuse — a normal rejection only hides the comment text.')) {
                          onDelete(r.id);
                        }
                      }}
                      disabled={loadingId === String(r.id)}
                      className="admin-btn"
                      style={{ background: 'rgba(128, 128, 128, 0.3)' }}
                      title="Delete the whole review (rating + comment) — for spam/abuse"
                    >
                      Delete
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
