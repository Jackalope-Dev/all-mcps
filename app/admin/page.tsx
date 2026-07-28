import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../db/schema';
import { eq, desc, isNotNull } from 'drizzle-orm';
import { getAuthorizedAdminEmail } from '../../lib/accessAuth';
import { getAdminStats, type AdminStats } from '../../lib/adminStats';
import AdminClient from './AdminClient';
import { StatsBar } from './StatsBar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Manage submissions and listings on AllMCPs.',
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
  engagement: { totalViews: 0, totalUpvotes: 0, totalCopies: 0 },
  topByViews: [],
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

      const map = (s: typeof pendingServers[0]) => ({
        ...s,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
      });

      return {
        pending: pendingServers.map(map),
        pendingEdits: pendingEdits.map(map),
        pendingClaims: pendingClaims.map(map),
        stats: await getAdminStats(db),
      };
    }
  } catch (e) {
    // Fallback if not in edge context
  }
  return { pending: [], pendingEdits: [], pendingClaims: [], stats: EMPTY_STATS };
}

export default async function AdminPage() {
  const reqHeaders = await headers();
  const email = await getAuthorizedAdminEmail(reqHeaders);

  if (!email) {
    return (
      <main className="container animate-fade-in" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h1>Unauthorized</h1>
        <p style={{ color: 'var(--text-secondary)' }}>This page is only accessible through Cloudflare Access.</p>
      </main>
    );
  }

  const { pending, pendingEdits, pendingClaims, stats } = await getAdminData();

  return (
    <main className="container animate-fade-in" style={{ padding: '4rem 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Admin Dashboard</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
        Review submissions and manage listings. Logged in as {email}.
      </p>

      <div style={{ maxWidth: '1100px', margin: '0 auto 2rem' }}>
        <StatsBar stats={stats} />
      </div>

      <AdminClient
        initialPending={pending as any}
        initialPendingEdits={pendingEdits as any}
        initialPendingClaims={pendingClaims as any}
      />
    </main>
  );
}
