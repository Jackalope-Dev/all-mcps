import { desc, eq, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { reports, reviews, servers, sponsorAds, users } from '../../db/schema';
import { type AdminStats, getAdminStats } from '../../lib/adminStats';
import { auth } from '../../lib/auth';
import AdminClient from './AdminClient';

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
      // Priority-review paid listings first
      const pendingServers = await db
        .select()
        .from(servers)
        .where(eq(servers.status, 'pending'))
        .orderBy(desc(servers.reviewPriority), desc(servers.createdAt));
      const pendingEdits = await db
        .select()
        .from(servers)
        .where(isNotNull(servers.pendingRevision))
        .orderBy(desc(servers.createdAt));
      const pendingClaims = await db
        .select()
        .from(servers)
        .where(isNotNull(servers.pendingClaimUserId))
        .orderBy(desc(servers.createdAt));
      const pendingLogos = await db
        .select()
        .from(servers)
        .where(isNotNull(servers.pendingLogoKey))
        .orderBy(desc(servers.createdAt));
      const pendingScreenshots = await db
        .select()
        .from(servers)
        .where(isNotNull(servers.pendingScreenshotKey))
        .orderBy(desc(servers.createdAt));
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
        pending: pendingServers.map(map),
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
    // Fallback if not in edge context
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
      <main
        className="container animate-fade-in"
        style={{ padding: '4rem 1rem', textAlign: 'center' }}
      >
        <h1 style={{ marginBottom: '1rem' }}>Unauthorized</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          This account doesn&apos;t have admin access.
        </p>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            marginTop: '1.5rem',
          }}
        >
          Just been granted access? Roles are cached at sign-in, so a stale
          session won&apos;t pick it up.{' '}
          <a
            href={`/api/auth/signout?callbackUrl=${encodeURIComponent('/login?callbackUrl=%2Fadmin')}`}
          >
            Log out and sign in again
          </a>
          .
        </p>
      </main>
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
    <main
      className="container animate-fade-in"
      style={{ padding: '2.5rem 1rem 4rem' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto 2rem' }}>
        <div
          style={{
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <h1
              style={{
                margin: '0 0 0.25rem',
                fontSize: '1.75rem',
                fontWeight: 800,
              }}
            >
              Admin Console
            </h1>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                margin: 0,
              }}
            >
              Control center for directory moderation, catalog management,
              social automation, and admin tools.
            </p>
          </div>
          <a
            href={`/api/auth/signout?callbackUrl=${encodeURIComponent('/')}`}
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Log out
          </a>
        </div>

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
      </div>
    </main>
  );
}
