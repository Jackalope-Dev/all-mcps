import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { servers } from '@/db/schema';
import { auth } from '@/lib/auth';
import { getServerAnalyticsBatch, type AnalyticsSummary } from '@/lib/analytics';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Developer Dashboard',
  description: 'Manage your Model Context Protocol server listings on AllMCPs.',
  robots: {
    index: false,
    follow: true,
  },
};

type OwnedServer = {
  id: string;
  name: string;
  description: string;
  category: string;
  websiteUrl?: string | null;
  pendingRevision?: string | null;
  logoUrl?: string | null;
  pendingLogoKey?: string | null;
  isPremium: boolean;
  status: string;
  featuredUntil: Date | null;
  categorySponsorUntil: Date | null;
  websiteVerified: boolean;
  isOfficial: boolean;
  reciprocalBadgeOk: boolean;
  views: number;
  copies: number;
  upvotes: number;
};

async function getOwnedServers(userId: string): Promise<{
  servers: OwnedServer[];
  analytics: Record<string, AnalyticsSummary>;
  isPremium: boolean;
}> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db
        .select({
          id: servers.id,
          name: servers.name,
          description: servers.description,
          category: servers.category,
          websiteUrl: servers.websiteUrl,
          pendingRevision: servers.pendingRevision,
          logoUrl: servers.logoUrl,
          pendingLogoKey: servers.pendingLogoKey,
          isPremium: servers.isPremium,
          status: servers.status,
          featuredUntil: servers.featuredUntil,
          categorySponsorUntil: servers.categorySponsorUntil,
          websiteVerified: servers.websiteVerified,
          isOfficial: servers.isOfficial,
          reciprocalBadgeOk: servers.reciprocalBadgeOk,
          views: servers.views,
          copies: servers.copies,
          upvotes: servers.upvotes,
        })
        .from(servers)
        .where(eq(servers.ownerUserId, userId));

      const isPremium = rows.some((r) => r.isPremium);
      const serverIds = rows.map((r) => r.id);

      // Fetch batch analytics summaries
      let analytics: Record<string, AnalyticsSummary> = {};
      if (serverIds.length > 0) {
        try {
          analytics = await getServerAnalyticsBatch(db, serverIds, 30);
        } catch {
          // Analytics may fail before migration runs — graceful fallback
        }
      }

      return { servers: rows as OwnedServer[], analytics, isPremium };
    }
  } catch {
    // fall through with empty list
  }
  return { servers: [], analytics: {}, isPremium: false };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard');
  }

  const { servers: ownedServers, analytics, isPremium } = await getOwnedServers(session.user.id);
  const { edit } = await searchParams;

  return (
    <main className="page-shell page-shell--content animate-fade-in">
      <div className="page-shell-inner">
        <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="text-page-title">Developer Dashboard</h1>
            <p className="text-lead" style={{ margin: 0 }}>
              Manage your claimed MCP servers, track LLM usage analytics, and optimize backlink health.
            </p>
          </div>
          <a href="/submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
            <span>+</span> Submit New Server
          </a>
        </header>
        <DashboardClient
          initialServers={ownedServers as any}
          initialAnalytics={analytics}
          isPremium={isPremium}
          initialEditId={edit ?? null}
        />
      </div>
    </main>
  );
}
