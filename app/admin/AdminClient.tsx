'use client';

import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  List,
  Mail,
  MailX,
  Megaphone,
  Send,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { AdminStats } from '@/lib/adminStats';
import { toast } from '../../components/ui/Toast';
import { notifyAdminStatsChanged } from '../../lib/adminStatsRefresh';
import { hueClass } from '../../lib/palette';
import { parsePendingRevision } from '../../lib/pendingRevision';
import { AdminAdsControl } from './AdminAdsControl';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminAutomationPanel } from './AdminAutomationPanel';
import { AdminBlogDrafts } from './AdminBlogDrafts';
import { AdminToolsControl } from './AdminCronsControl';
import { AdminTriageQueue } from './AdminTriageQueue';
import { AdminEmpty, AdminModal, AdminSectionHead } from './AdminUi';
import ManageListings, { type ListingFilters } from './ManageListings';
import { type KpiCardSelection, StatsBar } from './StatsBar';

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
  reviewFlagged?: boolean;
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
  githubStars?: number | null;
  npmDownloads?: number | null;
  installKind?: string | null;
  installCommand?: string | null;
  installPackage?: string | null;
  logoUrl?: string | null;
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
  duplicate: 'Possible duplicate (weekly sweep)',
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
  initialAds = [],
  initialBlogReadyCount = 0,
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
  initialAds?: any[];
  initialBlogReadyCount?: number;
  stats: AdminStats;
}) {
  const [pending, setPending] = useState<Server[]>(initialPending);
  const [pendingEdits, setPendingEdits] =
    useState<Server[]>(initialPendingEdits);
  const [pendingClaims, setPendingClaims] =
    useState<Server[]>(initialPendingClaims);
  const [pendingLogos, setPendingLogos] =
    useState<Server[]>(initialPendingLogos);
  const [pendingScreenshots, setPendingScreenshots] = useState<Server[]>(
    initialPendingScreenshots,
  );
  const [openReports, setOpenReports] =
    useState<ReportItem[]>(initialOpenReports);
  const [pendingReviewComments, setPendingReviewComments] = useState<
    ReviewCommentItem[]
  >(initialPendingReviewComments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [blogReadyCount, setBlogReadyCount] = useState(initialBlogReadyCount);

  // Rejection Reason Modal State
  const [rejectingItem, setRejectingItem] = useState<{
    id: string;
    name: string;
    action:
      | 'reject'
      | 'reject_edit'
      | 'reject_claim'
      | 'reject_logo'
      | 'reject_screenshot'
      | 'reject_review_comment';
    submitterEmail?: string | null;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Rows with no submitterEmail came from ingest (/api/cron/ingest), never a
  // human /api/submit — those self-resolve via the 4-hourly /api/cron/auto-promote
  // job (7-day dwell + fresh liveness check, then active or removed) without
  // any admin action. Keeping them out of the "needs you" badge/count is what
  // makes that badge mean what an admin expects it to mean; they're still
  // visible in a collapsed section below for transparency.
  const manualPending = pending.filter((s) => s.submitterEmail);
  const syncPending = pending.filter((s) => !s.submitterEmail);

  const totalPending =
    manualPending.length +
    pendingEdits.length +
    pendingClaims.length +
    pendingLogos.length +
    pendingScreenshots.length +
    pendingReviewComments.length;
  const defaultTab = totalPending > 0 ? 'moderation' : 'listings';
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'moderation'
    | 'listings'
    | 'triage'
    | 'ads'
    | 'blog'
    | 'analytics'
    | 'crons'
    | 'tools'
  >(defaultTab);
  const [modSubTab, setModSubTab] = useState<
    | 'submissions'
    | 'edits'
    | 'claims'
    | 'logos'
    | 'screenshots'
    | 'reviews'
    | 'reports'
  >('submissions');
  const [activeListingsFilters, setActiveListingsFilters] = useState<
    ListingFilters | undefined
  >(undefined);

  const handleKpiCardSelect = (selection: KpiCardSelection) => {
    const targetTab =
      (selection.tab as string) === 'overview' ? 'listings' : selection.tab;
    setActiveTab(targetTab as any);
    if (selection.filters) {
      setActiveListingsFilters(selection.filters);
    }
  };

  const openRejectModal = (
    id: string,
    name: string,
    action:
      | 'reject'
      | 'reject_edit'
      | 'reject_claim'
      | 'reject_logo'
      | 'reject_screenshot'
      | 'reject_review_comment',
    submitterEmail?: string | null,
  ) => {
    setRejectingItem({ id, name, action, submitterEmail });
    setRejectionReason(
      action === 'reject_review_comment'
        ? "Your written comment wasn't approved for public display. Your star rating still counts as-is — only the comment text was affected."
        : 'Your submission was not approved because the details or repository information were incomplete. You are welcome to update your information and submit again.',
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
    extra?: { reason?: string },
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
        toast.success(
          action === 'approve'
            ? 'Listing approved'
            : 'Listing rejected & submitter notified',
        );
        notifyAdminStatsChanged();
      } else if (action === 'approve_edit' || action === 'reject_edit') {
        setPendingEdits((prev) => prev.filter((s) => s.id !== id));
        toast.success(
          action === 'approve_edit' ? 'Edit approved' : 'Edit rejected',
        );
      } else if (action === 'approve_claim' || action === 'reject_claim') {
        setPendingClaims((prev) => prev.filter((s) => s.id !== id));
        toast.success(
          action === 'approve_claim' ? 'Claim approved' : 'Claim rejected',
        );
      } else if (
        action === 'approve_screenshot' ||
        action === 'reject_screenshot'
      ) {
        setPendingScreenshots((prev) => prev.filter((s) => s.id !== id));
        toast.success(
          action === 'approve_screenshot'
            ? 'Screenshot approved'
            : 'Screenshot rejected',
        );
      } else if (action === 'resend_approval') {
        toast.success(data.message || 'Approval email resent');
      } else if (
        action === 'mark_report_reviewed' ||
        action === 'dismiss_report'
      ) {
        setOpenReports((prev) => prev.filter((r) => String(r.id) !== id));
        toast.success(
          action === 'mark_report_reviewed'
            ? 'Report marked reviewed'
            : 'Report dismissed',
        );
      } else if (
        action === 'approve_review_comment' ||
        action === 'reject_review_comment' ||
        action === 'delete_review'
      ) {
        setPendingReviewComments((prev) =>
          prev.filter((r) => String(r.id) !== id),
        );
        toast.success(
          action === 'approve_review_comment'
            ? 'Comment approved'
            : action === 'reject_review_comment'
              ? 'Comment rejected'
              : 'Review deleted',
        );
      } else {
        setPendingLogos((prev) => prev.filter((s) => s.id !== id));
        toast.success(
          action === 'approve_logo' ? 'Logo approved' : 'Logo rejected',
        );
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
      label: 'Moderation',
      icon: Clock,
      badge: totalPending > 0 ? totalPending : undefined,
      badgeHue: 'hue-amber',
    },
    { id: 'triage', label: 'Triage (Jev)', icon: Sparkles },
    { id: 'listings', label: 'Listings', icon: List },
    {
      id: 'ads',
      label: 'Ads & sponsors',
      icon: Megaphone,
      badge:
        initialAds.filter((a) => a.status === 'pending_approval').length ||
        undefined,
      badgeHue: 'hue-cyan',
    },
    {
      id: 'blog',
      label: 'Blog drafts',
      icon: FileText,
      badge: blogReadyCount > 0 ? blogReadyCount : undefined,
      badgeHue: 'hue-green',
    },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'tools', label: 'Tools', icon: Wrench },
  ];

  const modTabs = [
    {
      id: 'submissions',
      label: 'Submissions',
      count: manualPending.length,
      extra: syncPending.length > 0 ? `+${syncPending.length} auto` : '',
    },
    { id: 'edits', label: 'Edits', count: pendingEdits.length, extra: '' },
    { id: 'claims', label: 'Claims', count: pendingClaims.length, extra: '' },
    { id: 'logos', label: 'Logos', count: pendingLogos.length, extra: '' },
    {
      id: 'screenshots',
      label: 'Screenshots',
      count: pendingScreenshots.length,
      extra: '',
    },
    {
      id: 'reviews',
      label: 'Review comments',
      count: pendingReviewComments.length,
      extra: '',
    },
    { id: 'reports', label: 'Reports', count: openReports.length, extra: '' },
  ] as const;

  return (
    <div className="adm-shell">
      {/* KPI Stats Deck */}
      <StatsBar
        initialStats={stats}
        onSelectCard={handleKpiCardSelect}
        onSelectTab={(tab: any) => setActiveTab(tab)}
      />

      {/* Main tab navigation */}
      <nav className="adm-tabs" aria-label="Admin sections">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className="adm-tab"
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className={`adm-tab-count ${item.badgeHue}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="adm-stack-lg">
          <section className="adm-section">
            <AdminSectionHead
              title="Recently approved listings"
              description="The most recently added live listings — newest first."
            />
            <RecentlyAddedTable
              servers={recentlyAdded}
              loadingId={loadingId}
              onResendApproval={(id) => handleAction(id, 'resend_approval')}
            />
          </section>

          <section className="adm-section">
            <AdminSectionHead title="Site operations overview" />
            <AdminAnalyticsView stats={stats} />
          </section>
        </div>
      )}

      {/* TAB 2: MODERATION QUEUE */}
      {activeTab === 'moderation' && (
        <div className="adm-section">
          {/* Moderation sub-tabs */}
          <div className="adm-subnav scroll-x fade-x">
            {modTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setModSubTab(t.id)}
                className="chip"
                aria-pressed={modSubTab === t.id}
              >
                {t.label}
                <span className="chip-count">
                  {t.count}
                  {t.extra ? ` ${t.extra}` : ''}
                </span>
              </button>
            ))}
          </div>

          {modSubTab === 'submissions' && (
            <section className="adm-section">
              <AdminSectionHead
                title="Pending submissions"
                count={
                  manualPending.length < stats.pendingCounts.submissions
                    ? `${manualPending.length} of ${stats.pendingCounts.submissions}`
                    : manualPending.length
                }
                description="Manual submissions, paid priority reviews and intake-flagged ones first."
              />
              <ServerTable
                servers={manualPending}
                empty="No manual submissions waiting on you."
                loadingId={loadingId}
                onApprove={(id) => handleAction(id, 'approve')}
                onReject={(server) =>
                  openRejectModal(
                    server.id,
                    server.name,
                    'reject',
                    server.submitterEmail,
                  )
                }
              />
              {syncPending.length > 0 && (
                <details className="adm-disclosure">
                  <summary>
                    <ChevronRight size={16} aria-hidden="true" />
                    <span className="adm-disclosure-title">
                      Auto-sync queue
                      <span className="adm-count">
                        {syncPending.length}
                        {syncPending.length < stats.pendingCounts.syncQueue
                          ? ` of ${stats.pendingCounts.syncQueue}`
                          : ''}
                      </span>
                    </span>
                    <span className="adm-disclosure-hint">
                      No submitter, self-resolving
                    </span>
                  </summary>
                  <div className="adm-disclosure-body">
                    <p className="adm-sub">
                      These came from the registry sync
                      (scripts/ingest-sources.mjs), not a manual submission. The
                      daily auto-promote cron re-checks each one is still alive
                      after a 7-day dwell and either promotes it to active or,
                      after 30 days with no working interface, removes it — no
                      admin action needed. Listed here for visibility;
                      approve/reject still works as a manual override.
                    </p>
                    <ServerTable
                      servers={syncPending}
                      empty="No auto-sync listings waiting."
                      loadingId={loadingId}
                      onApprove={(id) => handleAction(id, 'approve')}
                      onReject={(server) =>
                        openRejectModal(
                          server.id,
                          server.name,
                          'reject',
                          server.submitterEmail,
                        )
                      }
                    />
                  </div>
                </details>
              )}
            </section>
          )}

          {modSubTab === 'edits' && (
            <section className="adm-section">
              <AdminSectionHead
                title="Pending owner edits"
                count={pendingEdits.length}
                description="Owner-submitted revisions. Approving applies them immediately."
              />
              <PendingEditsTable
                servers={pendingEdits}
                loadingId={loadingId}
                onApprove={(id) => handleAction(id, 'approve_edit')}
                onReject={(server) =>
                  openRejectModal(server.id, server.name, 'reject_edit')
                }
              />
            </section>
          )}

          {modSubTab === 'claims' && (
            <section className="adm-section">
              <AdminSectionHead
                title="Pending ownership claims"
                count={pendingClaims.length}
                description="Claimants who verified website ownership via DNS or site badge."
              />
              <PendingClaimsTable
                servers={pendingClaims}
                loadingId={loadingId}
                onApprove={(id) => handleAction(id, 'approve_claim')}
                onReject={(server) =>
                  openRejectModal(server.id, server.name, 'reject_claim')
                }
              />
            </section>
          )}

          {modSubTab === 'logos' && (
            <section className="adm-section">
              <AdminSectionHead
                title="Pending custom logos"
                count={pendingLogos.length}
                description="Logos uploaded by verified owners awaiting approval before publication."
              />
              <PendingLogosTable
                servers={pendingLogos}
                loadingId={loadingId}
                onApprove={(id) => handleAction(id, 'approve_logo')}
                onReject={(server) =>
                  openRejectModal(server.id, server.name, 'reject_logo')
                }
              />
            </section>
          )}

          {modSubTab === 'screenshots' && (
            <section className="adm-section">
              <AdminSectionHead
                title="Pending screenshots"
                count={pendingScreenshots.length}
                description="Screenshots uploaded by verified owners awaiting approval before publication."
              />
              <PendingScreenshotsTable
                servers={pendingScreenshots}
                loadingId={loadingId}
                onApprove={(id) => handleAction(id, 'approve_screenshot')}
                onReject={(server) =>
                  openRejectModal(server.id, server.name, 'reject_screenshot')
                }
              />
            </section>
          )}

          {modSubTab === 'reviews' && (
            <section className="adm-section">
              <AdminSectionHead
                title="Pending review comments"
                count={pendingReviewComments.length}
                description={
                  <>
                    Star ratings publish immediately and aren&rsquo;t gated here
                    — only the written comment text needs approval before
                    it&rsquo;s shown publicly.
                  </>
                }
              />
              <PendingReviewsTable
                reviews={pendingReviewComments}
                loadingId={loadingId}
                onApprove={(id) =>
                  handleAction(String(id), 'approve_review_comment')
                }
                onReject={(review) =>
                  openRejectModal(
                    String(review.id),
                    review.serverName || review.serverId,
                    'reject_review_comment',
                  )
                }
                onDelete={(id) => handleAction(String(id), 'delete_review')}
              />
            </section>
          )}

          {modSubTab === 'reports' && (
            <section className="adm-section">
              <AdminSectionHead
                title="Open reports"
                count={openReports.length}
                description={
                  <>
                    Visitor-flagged problems, triage-only — never directly
                    affects a listing&rsquo;s public score. Act on the listing
                    itself (edit/unpublish) via Listings if a report is valid.
                  </>
                }
              />
              <PendingReportsTable
                reports={openReports}
                loadingId={loadingId}
                onReviewed={(id) =>
                  handleAction(String(id), 'mark_report_reviewed')
                }
                onDismiss={(id) => handleAction(String(id), 'dismiss_report')}
              />
            </section>
          )}
        </div>
      )}

      {/* TAB: JEV TRIAGE QUEUE */}
      {activeTab === 'triage' && (
        <div className="adm-stack-lg">
          <AdminAutomationPanel />
          <AdminTriageQueue />
        </div>
      )}

      {/* TAB 3: LISTINGS DIRECTORY */}
      {activeTab === 'listings' && (
        <section className="adm-section">
          <AdminSectionHead
            title="Directory listings"
            description="Search, filter, edit metadata, adjust status, grant boost placements, or open the inspector."
          />
          <ManageListings initialFilters={activeListingsFilters} />
        </section>
      )}

      {/* TAB: ADS & SPONSORS */}
      {activeTab === 'ads' && (
        <section className="adm-section">
          <AdminSectionHead
            title="Sponsor ads"
            description="Review sponsor campaigns, approve submissions, monitor impression delivery, and track click-through."
          />
          <AdminAdsControl initialAds={initialAds} />
        </section>
      )}

      {/* TAB: BLOG DRAFTS */}
      {activeTab === 'blog' && (
        <section className="adm-section">
          <AdminSectionHead
            title="Blog drafts"
            description="Posts written and self-reviewed by the blog pipeline. Read one, then approve to commit it to main and deploy."
          />
          <AdminBlogDrafts onCountChange={setBlogReadyCount} />
        </section>
      )}

      {/* TAB 4: ANALYTICS & LOGS */}
      {activeTab === 'analytics' && (
        <section className="adm-section">
          <AdminSectionHead
            title="Analytics & logs"
            description="Catalog coverage, demand gaps, agent traffic, surface impressions and engagement."
          />
          <AdminAnalyticsView stats={stats} />
        </section>
      )}

      {/* TAB 6: ADMIN TOOLS & UTILITIES */}
      {(activeTab === 'tools' || (activeTab as string) === 'crons') && (
        <section className="adm-section">
          <AdminSectionHead
            title="Tools & maintenance"
            description="Run one-click maintenance jobs, inspect a listing's quality score, or apply quick overrides."
          />
          <AdminToolsControl />
        </section>
      )}

      {/* Rejection reason & email modal */}
      {rejectingItem && (
        <AdminModal
          title="Reject & send feedback"
          subtitle={rejectingItem.name}
          icon={MailX}
          hue="hue-red"
          onClose={() => setRejectingItem(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAction(rejectingItem.id, rejectingItem.action, {
                    reason: rejectionReason.trim(),
                  });
                  setRejectingItem(null);
                }}
                disabled={loadingId === rejectingItem.id}
                className="btn btn-sm adm-btn-danger-solid"
              >
                Confirm rejection & send email
              </button>
            </>
          }
        >
          <p className="adm-dialog-note">
            <Mail size={14} aria-hidden="true" />
            {rejectingItem.submitterEmail ? (
              <span>
                Notification email will be sent to{' '}
                <strong>{rejectingItem.submitterEmail}</strong>
              </span>
            ) : (
              <span>No submitter email attached (anonymous submission).</span>
            )}
          </p>
          <div className="adm-field">
            <label htmlFor="admin-rejection-reason">
              Rejection reason / feedback to submitter
            </label>
            <textarea
              id="admin-rejection-reason"
              className="form-input adm-textarea"
              rows={5}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason or instructions..."
            />
          </div>
        </AdminModal>
      )}
    </div>
  );
}

/** Readable hostname+path for a review link, so admins can eyeball a URL without opening it. */
function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
    return `${u.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return url;
  }
}

function fmtDay(v: string): string {
  return new Date(v).toLocaleDateString();
}

/** Full-width empty row for a moderation table. */
function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr className="adm-table-empty">
      <td colSpan={colSpan}>
        <AdminEmpty icon={CheckCircle2} title="All clear">
          {text}
        </AdminEmpty>
      </td>
    </tr>
  );
}

/** Approve / reject pair shared by every moderation queue. */
function DecisionButtons({
  busy,
  onApprove,
  onReject,
}: {
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onApprove}
        disabled={busy}
        className="btn btn-sm adm-btn-tint hue-green"
      >
        <Check size={14} aria-hidden="true" /> Approve
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={busy}
        className="btn btn-sm adm-btn-tint hue-red"
      >
        <X size={14} aria-hidden="true" /> Reject
      </button>
    </>
  );
}

function ListingLink({
  serverId,
  serverName,
}: {
  serverId: string;
  serverName?: string | null;
}) {
  return serverName ? (
    <a
      href={`/mcp/${serverId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="adm-row-link"
    >
      {serverName}
    </a>
  ) : (
    <span className="adm-anon">{serverId} (removed)</span>
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
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th>Name & details</th>
            <th>Links</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <EmptyRow colSpan={4} text={empty} />
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
              const chips: { label: string; value: string }[] = [];
              if (server.githubStars != null)
                chips.push({
                  label: '★ Stars',
                  value: server.githubStars.toLocaleString(),
                });
              if (server.npmDownloads != null)
                chips.push({
                  label: 'npm dl',
                  value: server.npmDownloads.toLocaleString(),
                });
              if (tagsList.length > 0)
                chips.push({ label: 'Tags', value: tagsList.join(', ') });
              if (server.pricingModel)
                chips.push({
                  label: 'Pricing',
                  value: server.pricingNotes
                    ? `${server.pricingModel} (${server.pricingNotes})`
                    : server.pricingModel,
                });
              if (server.authType)
                chips.push({ label: 'Auth', value: server.authType });
              if (server.license)
                chips.push({ label: 'License', value: server.license });
              if (server.maintenanceStatus)
                chips.push({
                  label: 'Maintenance',
                  value: server.maintenanceStatus,
                });
              if (clientsList.length > 0)
                chips.push({
                  label: 'Clients',
                  value: clientsList.join(', '),
                });
              if (server.supportUrl)
                chips.push({ label: 'Support', value: server.supportUrl });
              const installPreview =
                server.installCommand || server.suggestedInstallCommand || null;
              const installArgsPreview = Array.isArray(
                server.suggestedInstallArgs,
              )
                ? server.suggestedInstallArgs.join(' ')
                : server.suggestedInstallArgs || '';
              if (installPreview)
                chips.push({
                  label: server.installCommand ? 'Install' : 'Install hint',
                  value: server.installPackage
                    ? `${installPreview} ${server.installPackage}`
                    : `${installPreview}${installArgsPreview ? ` ${installArgsPreview}` : ''}`,
                });

              return (
                <tr key={server.id}>
                  <td data-label="Name" className="adm-cell-main">
                    <div className="adm-name">
                      {server.logoUrl && (
                        <img
                          src={server.logoUrl}
                          alt=""
                          width={20}
                          height={20}
                          className="adm-logo"
                        />
                      )}
                      <strong>{server.name}</strong>
                      {server.reviewPriority && (
                        <span className="adm-tag hue-amber">Priority</span>
                      )}
                      {server.reviewFlagged && (
                        <span className="adm-tag hue-red">Needs a look</span>
                      )}
                      {server.isPremium && (
                        <span className="adm-tag hue-violet">Premium</span>
                      )}
                      {server.category && (
                        <span
                          className={`adm-tag ${hueClass(server.category)}`}
                        >
                          {server.category}
                        </span>
                      )}
                    </div>

                    <div className="adm-meta-line">
                      <Mail size={13} aria-hidden="true" />
                      <span>Submitter:</span>
                      {server.submitterEmail ? (
                        <strong>{server.submitterEmail}</strong>
                      ) : (
                        <span className="adm-anon">Anonymous</span>
                      )}
                    </div>

                    <div className="adm-desc">{server.description}</div>

                    {chips.length > 0 && (
                      <div className="adm-facts">
                        {chips.map((chip) => (
                          <span
                            key={chip.label}
                            title={`${chip.label}: ${chip.value}`}
                            className="adm-fact"
                          >
                            <b>{chip.label}:</b> {chip.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td data-label="Links">
                    <div className="adm-links">
                      <a
                        href={server.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={server.url}
                        className="adm-link"
                      >
                        {shortUrl(server.url)}
                      </a>
                      {server.websiteUrl && (
                        <a
                          href={server.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={server.websiteUrl}
                          className="adm-link"
                        >
                          {shortUrl(server.websiteUrl)}
                        </a>
                      )}
                    </div>
                  </td>
                  <td data-label="Submitted" className="adm-cell-date">
                    {fmtDay(server.createdAt)}
                  </td>
                  <td data-label="Actions">
                    <div className="adm-actions">
                      <DecisionButtons
                        busy={loadingId === server.id}
                        onApprove={() => onApprove(server.id)}
                        onReject={() => onReject(server)}
                      />
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
    <div className="adm-table-wrap">
      <table className="adm-table">
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
            <EmptyRow colSpan={5} text="No live listings yet." />
          ) : (
            servers.map((server) => (
              <tr key={server.id}>
                <td data-label="Name">
                  <div className="adm-name">
                    <strong>{server.name}</strong>
                    {server.isPremium && (
                      <span className="adm-tag hue-violet">Premium</span>
                    )}
                    {server.isOfficial && (
                      <span className="adm-tag hue-green">Official</span>
                    )}
                  </div>
                </td>
                <td data-label="Category">
                  {server.category ? (
                    <span className={`adm-tag ${hueClass(server.category)}`}>
                      {server.category}
                    </span>
                  ) : (
                    <span className="adm-anon">—</span>
                  )}
                </td>
                <td data-label="Links">
                  <div className="adm-links adm-links--row">
                    <a
                      href={`/mcp/${server.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-link"
                    >
                      Listing
                    </a>
                    <a
                      href={server.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-link"
                    >
                      Repo
                    </a>
                    {server.websiteUrl && (
                      <a
                        href={server.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="adm-link"
                      >
                        Website
                      </a>
                    )}
                  </div>
                </td>
                <td data-label="Added" className="adm-cell-date">
                  {fmtDay(server.createdAt)}
                </td>
                <td data-label="Actions">
                  <div className="adm-actions">
                    <button
                      type="button"
                      onClick={() => onResendApproval(server.id)}
                      disabled={loadingId === server.id}
                      className="btn btn-sm btn-secondary"
                      title="Re-send the listing-approved email"
                    >
                      <Send size={14} aria-hidden="true" /> Resend approval
                      email
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
    <div className="adm-table-wrap">
      <table className="adm-table">
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
            <EmptyRow colSpan={4} text="No pending edits." />
          ) : (
            servers.map((server) => {
              const pending = parsePendingRevision(server.pendingRevision);
              if (!pending) return null;
              const fields = Object.keys(
                pending.proposed,
              ) as (keyof typeof pending.proposed)[];
              const serverRow = server as Record<string, unknown>;
              const formatVal = (v: unknown): string => {
                if (v == null || v === '') return '(empty)';
                if (Array.isArray(v))
                  return v.length ? v.join(', ') : '(empty)';
                return String(v);
              };
              return (
                <tr key={server.id}>
                  <td data-label="Listing">
                    <strong className="adm-strong">{server.name}</strong>
                  </td>
                  <td data-label="Proposed changes" className="adm-cell-main">
                    <div className="adm-diff">
                      {fields.map((field) => {
                        const currentRaw = serverRow[field as string];
                        return (
                          <div key={field}>
                            <div className="adm-diff-key">{field}</div>
                            <div className="adm-diff-old">
                              {formatVal(currentRaw)}
                            </div>
                            <div className="adm-diff-new">
                              {formatVal(pending.proposed[field])}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td data-label="Submitted" className="adm-cell-date">
                    {fmtDay(pending.submittedAt)}
                  </td>
                  <td data-label="Actions">
                    <div className="adm-actions">
                      <DecisionButtons
                        busy={loadingId === server.id}
                        onApprove={() => onApprove(server.id)}
                        onReject={() => onReject(server)}
                      />
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
    <div className="adm-table-wrap">
      <table className="adm-table">
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
            <EmptyRow colSpan={4} text="No pending claims." />
          ) : (
            servers.map((server) => (
              <tr key={server.id}>
                <td data-label="Listing">
                  <strong className="adm-strong">{server.name}</strong>
                </td>
                <td data-label="Repo">
                  <a
                    href={server.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={server.url}
                    className="adm-link"
                  >
                    {shortUrl(server.url)}
                  </a>
                </td>
                <td data-label="Proven website">
                  {server.pendingClaimWebsiteUrl ? (
                    <a
                      href={server.pendingClaimWebsiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-link adm-link--wrap"
                    >
                      {server.pendingClaimWebsiteUrl}
                    </a>
                  ) : (
                    <span className="adm-anon">—</span>
                  )}
                </td>
                <td data-label="Actions">
                  <div className="adm-actions">
                    <DecisionButtons
                      busy={loadingId === server.id}
                      onApprove={() => onApprove(server.id)}
                      onReject={() => onReject(server)}
                    />
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
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th>Listing</th>
            <th>Preview</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <EmptyRow colSpan={3} text="No pending logos." />
          ) : (
            servers.map((server) => (
              <tr key={server.id}>
                <td data-label="Listing">
                  <strong className="adm-strong">{server.name}</strong>
                </td>
                <td data-label="Preview">
                  {server.pendingLogoKey && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/admin/logo-preview?key=${encodeURIComponent(server.pendingLogoKey)}`}
                      alt={`${server.name} pending logo`}
                      width={64}
                      height={64}
                      className="adm-thumb adm-thumb--logo"
                    />
                  )}
                </td>
                <td data-label="Actions">
                  <div className="adm-actions">
                    <DecisionButtons
                      busy={loadingId === server.id}
                      onApprove={() => onApprove(server.id)}
                      onReject={() => onReject(server)}
                    />
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
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th>Listing</th>
            <th>Preview</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <EmptyRow colSpan={3} text="No pending screenshots." />
          ) : (
            servers.map((server) => (
              <tr key={server.id}>
                <td data-label="Listing">
                  <strong className="adm-strong">{server.name}</strong>
                </td>
                <td data-label="Preview">
                  {server.pendingScreenshotKey && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/admin/logo-preview?key=${encodeURIComponent(server.pendingScreenshotKey)}`}
                      alt={`${server.name} pending screenshot`}
                      width={160}
                      height={94}
                      className="adm-thumb adm-thumb--shot"
                    />
                  )}
                </td>
                <td data-label="Actions">
                  <div className="adm-actions">
                    <DecisionButtons
                      busy={loadingId === server.id}
                      onApprove={() => onApprove(server.id)}
                      onReject={() => onReject(server)}
                    />
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
    <div className="adm-table-wrap">
      <table className="adm-table">
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
            <EmptyRow colSpan={5} text="No open reports." />
          ) : (
            reports.map((r) => (
              <tr key={r.id}>
                <td data-label="Listing">
                  <ListingLink
                    serverId={r.serverId}
                    serverName={r.serverName}
                  />
                </td>
                <td data-label="Reason">
                  <span
                    className={`adm-tag ${r.reason === 'malicious' ? 'hue-red' : 'hue-amber'}`}
                  >
                    {REPORT_REASON_LABELS[r.reason] || r.reason}
                  </span>
                </td>
                <td data-label="Details" className="adm-cell-text">
                  {r.details ? (
                    <span className="adm-muted">{r.details}</span>
                  ) : (
                    <span className="adm-anon">—</span>
                  )}
                </td>
                <td data-label="Reported" className="adm-cell-date">
                  {fmtDay(r.createdAt)}
                </td>
                <td data-label="Actions">
                  <div className="adm-actions">
                    <button
                      type="button"
                      onClick={() => onReviewed(r.id)}
                      disabled={loadingId === String(r.id)}
                      className="btn btn-sm adm-btn-tint hue-green"
                    >
                      <Check size={14} aria-hidden="true" /> Mark reviewed
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismiss(r.id)}
                      disabled={loadingId === String(r.id)}
                      className="btn btn-sm btn-secondary"
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
    <div className="adm-table-wrap">
      <table className="adm-table">
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
            <EmptyRow colSpan={5} text="No pending review comments." />
          ) : (
            reviews.map((r) => (
              <tr key={r.id}>
                <td data-label="Listing">
                  <ListingLink
                    serverId={r.serverId}
                    serverName={r.serverName}
                  />
                </td>
                <td data-label="Reviewer" className="adm-cell-wrap">
                  {r.reviewerEmail || <span className="adm-anon">Unknown</span>}
                </td>
                <td data-label="Rating">
                  <span
                    className="adm-stars"
                    role="img"
                    aria-label={`${r.rating} out of 5 stars`}
                  >
                    {'★'.repeat(r.rating)}
                    <span className="adm-stars-off">
                      {'☆'.repeat(5 - r.rating)}
                    </span>
                  </span>
                </td>
                <td data-label="Comment" className="adm-cell-text">
                  <span className="adm-muted">{r.comment}</span>
                </td>
                <td data-label="Actions">
                  <div className="adm-actions">
                    <DecisionButtons
                      busy={loadingId === String(r.id)}
                      onApprove={() => onApprove(r.id)}
                      onReject={() => onReject(r)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            'Permanently delete this review (rating and comment)? This is for spam/abuse — a normal rejection only hides the comment text.',
                          )
                        ) {
                          onDelete(r.id);
                        }
                      }}
                      disabled={loadingId === String(r.id)}
                      className="btn btn-sm btn-ghost"
                      title="Delete the whole review (rating + comment) — for spam/abuse"
                    >
                      <Trash2 size={14} aria-hidden="true" /> Delete
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
