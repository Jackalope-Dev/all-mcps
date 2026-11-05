import { asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Globe, LogOut, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageShell } from '../../components/PageShell';
import {
  listingSignals,
  reports,
  reviews,
  servers,
  sponsorAds,
  stdioVerifications,
  users,
} from '../../db/schema';
import { type AdminStats, getAdminStats } from '../../lib/adminStats';
import { auth } from '../../lib/auth';
import {
  GATE_EVIDENCE_COLUMNS,
  recommendPending,
  submitterSignals,
} from '../../lib/autoDecision';
import { calibrationNote, getGateCalibration } from '../../lib/gateCalibration';
import { getSubmitterHistory } from '../../lib/submitterHistory';
import AdminClient from './AdminClient';
import type { GateCallData } from './GateCall';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description:
    'Manage submissions, listings, and system automation on AllMCPs.',
  robots: {
    index: false,
    follow: false,
  },
};

const EMPTY_STATS: AdminStats = {
  statusCounts: { pending: 0, active: 0, removed: 0 },
  premiumCount: 0,
  featuredCount: 0,
  unhealthyCount: 0,
  aiEnrichedCount: 0,
  toolsCount: 0,
  usersCount: 0,
  categorySponsorsCount: 0,
  toolsIntrospectionErrorCount: 0,
  pendingCounts: {
    submissions: 0,
    syncQueue: 0,
    edits: 0,
    claims: 0,
    logos: 0,
    screenshots: 0,
    total: 0,
  },
  socialCounts: { queued: 0, sent: 0, failed: 0 },
  callerCounts: {},
  surfaceImpressions: {},
  logoSourceCounts: {
    manual: 0,
    readme: 0,
    website_favicon: 0,
    github_org: 0,
    github_user: 0,
    none: 0,
  },
  engagement: { totalViews: 0, totalUpvotes: 0, totalCopies: 0 },
  topByViews: [],
  recentToolsErrors: [],
};

async function getAdminData() {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      // Full-row, unbounded selects here blow the Worker's 128MB memory limit
      // once a queue grows into the thousands (each row renders as a full
      // <tr> client-side) - cap every moderation queue fetched below.
      const QUEUE_LIMIT = 200;
      // Manual submissions (submitterEmail set) always sort before the
      // sync-sourced auto-promote queue (submitterEmail null) — a large sync
      // backlog must never crowd genuine admin-review items out of the
      // QUEUE_LIMIT window (see AdminClient.tsx's manualPending/syncPending
      // split, which relies on manual rows actually being present here).
      // Priority-review paid listings first within each group, then
      // intake-flagged (likely spam / non-MCP) ones.
      const pendingServers = await db
        .select()
        .from(servers)
        .where(eq(servers.status, 'pending'))
        .orderBy(
          asc(sql`${servers.submitterEmail} IS NULL`),
          desc(servers.reviewPriority),
          desc(servers.reviewFlagged),
          desc(servers.createdAt),
        )
        .limit(QUEUE_LIMIT);
      // Track record per submitter email and domain, plus whether this is a
      // resubmission (lib/submitterHistory.ts). Never blocks the page.
      const history = await getSubmitterHistory(db, pendingServers).catch(
        (e) => {
          console.error('submitter history failed:', e);
          return new Map();
        },
      );
      // The gate's call and Jev's verdict for each manual submission, so the
      // Submissions tab shows the same recommendation as Triage (it used to
      // show neither). Never blocks the page.
      const gateCalls = await submissionGateCalls(
        db,
        pendingServers.filter((s) => s.submitterEmail).map((s) => s.id),
      ).catch((e) => {
        console.error('submission gate calls failed:', e);
        return new Map<string, SubmissionGateCall>();
      });
      const pendingEdits = await db
        .select()
        .from(servers)
        .where(isNotNull(servers.pendingRevision))
        .orderBy(desc(servers.createdAt))
        .limit(QUEUE_LIMIT);
      const pendingClaims = await db
        .select()
        .from(servers)
        .where(isNotNull(servers.pendingClaimUserId))
        .orderBy(desc(servers.createdAt))
        .limit(QUEUE_LIMIT);
      const pendingLogos = await db
        .select()
        .from(servers)
        .where(isNotNull(servers.pendingLogoKey))
        .orderBy(desc(servers.createdAt))
        .limit(QUEUE_LIMIT);
      const pendingScreenshots = await db
        .select()
        .from(servers)
        .where(isNotNull(servers.pendingScreenshotKey))
        .orderBy(desc(servers.createdAt))
        .limit(QUEUE_LIMIT);
      const openReports = await db
        .select({
          id: reports.id,
          serverId: reports.serverId,
          serverName: servers.name,
          reason: reports.reason,
          details: reports.details,
          status: reports.status,
          createdAt: reports.createdAt,
        })
        .from(reports)
        .leftJoin(servers, eq(servers.id, reports.serverId))
        .where(eq(reports.status, 'open'))
        .orderBy(desc(reports.createdAt));
      const pendingReviewComments = await db
        .select({
          id: reviews.id,
          serverId: reviews.serverId,
          serverName: servers.name,
          reviewerEmail: users.email,
          rating: reviews.rating,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .leftJoin(servers, eq(servers.id, reviews.serverId))
        .leftJoin(users, eq(users.id, reviews.userId))
        .where(eq(reviews.commentStatus, 'pending'))
        .orderBy(desc(reviews.createdAt));
      // Most-recently-added live listings, so newly approved MCPs are easy to find again.
      const recentlyAdded = await db
        .select({
          id: servers.id,
          name: servers.name,
          category: servers.category,
          url: servers.url,
          websiteUrl: servers.websiteUrl,
          isPremium: servers.isPremium,
          isOfficial: servers.isOfficial,
          createdAt: servers.createdAt,
        })
        .from(servers)
        .where(eq(servers.status, 'active'))
        .orderBy(desc(servers.createdAt))
        .limit(20);

      const ads = await db
        .select()
        .from(sponsorAds)
        .orderBy(desc(sponsorAds.createdAt));

      const map = (s: (typeof pendingServers)[0]) => ({
        ...s,
        createdAt:
          s.createdAt instanceof Date
            ? s.createdAt.toISOString()
            : String(s.createdAt),
      });
      const mapRecent = (s: (typeof recentlyAdded)[0]) => ({
        ...s,
        createdAt:
          s.createdAt instanceof Date
            ? s.createdAt.toISOString()
            : String(s.createdAt),
      });
      const mapAd = (a: (typeof ads)[0]) => ({
        ...a,
        createdAt:
          a.createdAt instanceof Date
            ? a.createdAt.toISOString()
            : String(a.createdAt),
        approvedAt:
          a.approvedAt instanceof Date
            ? a.approvedAt.toISOString()
            : a.approvedAt
              ? String(a.approvedAt)
              : null,
        completedAt:
          a.completedAt instanceof Date
            ? a.completedAt.toISOString()
            : a.completedAt
              ? String(a.completedAt)
              : null,
      });

      return {
        pending: pendingServers.map((s) => ({
          ...map(s),
          history: history.get(s.id) ?? null,
          gate: gateCalls.get(s.id) ?? null,
        })),
        pendingEdits: pendingEdits.map(map),
        pendingClaims: pendingClaims.map(map),
        pendingLogos: pendingLogos.map(map),
        pendingScreenshots: pendingScreenshots.map(map),
        openReports: openReports.map((r) => ({
          ...r,
          createdAt:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : String(r.createdAt),
        })),
        pendingReviewComments: pendingReviewComments.map((r) => ({
          ...r,
          createdAt:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : String(r.createdAt),
        })),
        recentlyAdded: recentlyAdded.map(mapRecent),
        ads: ads.map(mapAd),
        stats: await getAdminStats(db),
      };
    }
  } catch (e) {
    // Any one failed query lands here and renders every card as 0, so say why.
    console.error(
      '[admin] data load failed:',
      (e as { cause?: unknown })?.cause ?? e,
    );
  }
  return {
    pending: [],
    pendingEdits: [],
    pendingClaims: [],
    pendingLogos: [],
    pendingScreenshots: [],
    openReports: [],
    pendingReviewComments: [],
    recentlyAdded: [],
    ads: [],
    stats: EMPTY_STATS,
  };
}

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=%2Fadmin');
  }

  if ((session.user as any).role !== 'admin') {
    return (
      <PageShell variant="narrow" className="adm">
        <div className="adm-denied">
          <span className="tint-tile hue-amber" aria-hidden="true">
            <ShieldAlert size={22} />
          </span>
          <h1 className="adm-denied-title">Unauthorized</h1>
          <p className="adm-denied-sub">
            This account doesn&apos;t have admin access.
          </p>
          <p className="adm-denied-fine">
            Just been granted access? Roles are cached at sign-in, so a stale
            session won&apos;t pick it up.{' '}
            <a
              href={`/api/auth/signout?callbackUrl=${encodeURIComponent('/login?callbackUrl=%2Fadmin')}`}
            >
              Log out and sign in again
            </a>
            .
          </p>
        </div>
      </PageShell>
    );
  }

  const {
    pending,
    pendingEdits,
    pendingClaims,
    pendingLogos,
    pendingScreenshots,
    openReports,
    pendingReviewComments,
    recentlyAdded,
    ads,
    stats,
  } = await getAdminData();

  return (
    <PageShell variant="default" className="adm">
      <header className="adm-head">
        <div>
          <h1 className="text-page-title">Admin console</h1>
          <p className="text-lead">
            Moderation, catalog management, sponsors, automation and maintenance
            for AllMCPs.
          </p>
        </div>
        <div className="adm-head-actions">
          <Link href="/" className="btn btn-ghost btn-sm">
            <Globe size={14} aria-hidden="true" /> View site
          </Link>
          <a
            href={`/api/auth/signout?callbackUrl=${encodeURIComponent('/')}`}
            className="btn btn-secondary btn-sm"
          >
            <LogOut size={14} aria-hidden="true" /> Log out
          </a>
        </div>
      </header>

      <AdminClient
        initialPending={pending as any}
        initialPendingEdits={pendingEdits as any}
        initialPendingClaims={pendingClaims as any}
        initialPendingLogos={pendingLogos as any}
        initialPendingScreenshots={pendingScreenshots as any}
        initialOpenReports={openReports as any}
        initialPendingReviewComments={pendingReviewComments as any}
        recentlyAdded={recentlyAdded as any}
        initialAds={ads as any}
        stats={stats}
      />
    </PageShell>
  );
}

type SubmissionGateCall = {
  recommendation: GateCallData;
  triageVerdict: string | null;
  triageReason: string | null;
};

/** Indexed lookups by id (chunked under D1's bound-parameter cap). */
async function submissionGateCalls(
  db: ReturnType<typeof drizzle>,
  ids: string[],
): Promise<Map<string, SubmissionGateCall>> {
  const out = new Map<string, SubmissionGateCall>();
  if (ids.length === 0) return out;
  const [signals, calibration] = await Promise.all([
    submitterSignals(db, ids),
    getGateCalibration(db),
  ]);
  const now = new Date();
  for (let i = 0; i < ids.length; i += 90) {
    const rows = await db
      .select({
        ...GATE_EVIDENCE_COLUMNS,
        id: servers.id,
        submitterEmail: servers.submitterEmail,
        triageReason: listingSignals.triageReason,
      })
      .from(servers)
      .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
      .leftJoin(stdioVerifications, eq(stdioVerifications.serverId, servers.id))
      .where(inArray(servers.id, ids.slice(i, i + 90)));
    for (const r of rows) {
      const rec = recommendPending(
        {
          ...r,
          reviewFlagged: Boolean(r.reviewFlagged),
          ...signals.get(r.id),
        },
        now,
      );
      out.set(r.id, {
        recommendation: {
          ...rec,
          calibration: calibrationNote(
            calibration,
            rec.decision,
            r.triageVerdict,
          ),
        },
        triageVerdict: r.triageVerdict,
        triageReason: r.triageReason,
      });
    }
  }
  return out;
}
