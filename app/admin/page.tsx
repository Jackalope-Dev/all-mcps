import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../db/schema';
import { eq, desc, isNotNull } from 'drizzle-orm';
import { getAuthorizedAdminEmail } from '../../lib/accessAuth';
import { getAdminStats, type AdminStats } from '../../lib/adminStats';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Manage submissions, listings, and system automation on AllMCPs.',
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
  pendingCounts: { submissions: 0, edits: 0, claims: 0, logos: 0, screenshots: 0, total: 0 },
  socialCounts: { queued: 0, sent: 0, failed: 0 },
  callerCounts: {},
  surfaceImpressions: {},
  logoSourceCounts: { manual: 0, readme: 0, website_favicon: 0, github_org: 0, github_user: 0, none: 0 },
  engagement: { totalViews: 0, totalUpvotes: 0, totalCopies: 0 },
  topByViews: [],
  recentToolsErrors: [],
};

async function getAdminData() {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
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

      const map = (s: typeof pendingServers[0]) => ({
        ...s,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
      });
      const mapRecent = (s: typeof recentlyAdded[0]) => ({
        ...s,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
      });

      return {
        pending: pendingServers.map(map),
        pendingEdits: pendingEdits.map(map),
        pendingClaims: pendingClaims.map(map),
        pendingLogos: pendingLogos.map(map),
        pendingScreenshots: pendingScreenshots.map(map),
        recentlyAdded: recentlyAdded.map(mapRecent),
        stats: await getAdminStats(db),
      };
    }
  } catch (e) {
    // Fallback if not in edge context
  }
  return { pending: [], pendingEdits: [], pendingClaims: [], pendingLogos: [], pendingScreenshots: [], recentlyAdded: [], stats: EMPTY_STATS };
}

export default async function AdminPage() {
  const reqHeaders = await headers();
  const email = await getAuthorizedAdminEmail(reqHeaders);

  if (!email) {
    return (
      <main className="container animate-fade-in" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '1rem' }}>Unauthorized</h1>
        <p style={{ color: 'var(--text-secondary)' }}>This page is only accessible through Cloudflare Access.</p>
      </main>
    );
  }

  const { pending, pendingEdits, pendingClaims, pendingLogos, pendingScreenshots, recentlyAdded, stats } = await getAdminData();

  return (
    <main className="container animate-fade-in" style={{ padding: '2.5rem 1rem 4rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto 2rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.75rem', fontWeight: 800 }}>Admin Console</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Control center for directory moderation, catalog management, social automation, and admin tools.
          </p>
        </div>

        <AdminClient
          initialPending={pending as any}
          initialPendingEdits={pendingEdits as any}
          initialPendingClaims={pendingClaims as any}
          initialPendingLogos={pendingLogos as any}
          initialPendingScreenshots={pendingScreenshots as any}
          recentlyAdded={recentlyAdded as any}
          stats={stats}
        />
      </div>
    </main>
  );
}

