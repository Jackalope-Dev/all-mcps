import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { servers } from '@/db/schema';
import { auth } from '@/lib/auth';
import { getServerAnalyticsBatch, type AnalyticsSummary } from '@/lib/analytics';
import { parseStringArray } from '@/lib/aiContent';
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
  categoryRanks: Record<string, { rank: number; totalInCategory: number }>;
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
          healthStatus: servers.healthStatus,
          isVerifiedActive: servers.isVerifiedActive,
          githubStars: servers.githubStars,
          npmDownloads: servers.npmDownloads,
          tools: servers.tools,
          url: servers.url,
          tags: servers.tags,
          pricingModel: servers.pricingModel,
          pricingNotes: servers.pricingNotes,
          authType: servers.authType,
          license: servers.license,
          compatibleClients: servers.compatibleClients,
          maintenanceStatus: servers.maintenanceStatus,
          supportUrl: servers.supportUrl,
          suggestedInstallCommand: servers.suggestedInstallCommand,
          suggestedInstallArgs: servers.suggestedInstallArgs,
          screenshotUrl: servers.screenshotUrl,
          pendingScreenshotKey: servers.pendingScreenshotKey,
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

      // Compute category ranks for owned servers
      const { and, desc, sql } = await import('drizzle-orm');
      const categoryRanks: Record<string, { rank: number; totalInCategory: number }> = {};
      for (const server of rows) {
        try {
          const categoryList = await db
            .select({ id: servers.id })
            .from(servers)
            .where(and(eq(servers.category, server.category), eq(servers.status, 'active')))
            .orderBy(desc(sql`${servers.upvotes} * 10 + ${servers.views}`));

          const index = categoryList.findIndex((item) => item.id === server.id);
          if (index !== -1) {
            categoryRanks[server.id] = {
              rank: index + 1,
              totalInCategory: categoryList.length,
            };
          }
        } catch {
          // Fallback if category ranking query fails
        }
      }

      const normalized = rows.map((r) => ({
        ...r,
        tags: parseStringArray(r.tags),
        compatibleClients: parseStringArray(r.compatibleClients),
        suggestedInstallArgs: parseStringArray(r.suggestedInstallArgs),
      }));

      return { servers: normalized as OwnedServer[], analytics, categoryRanks, isPremium };
    }
  } catch {
    // fall through with empty list
  }
  return { servers: [], analytics: {}, categoryRanks: {}, isPremium: false };
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

  const { servers: ownedServers, analytics, categoryRanks, isPremium } = await getOwnedServers(session.user.id);
  const { edit } = await searchParams;

  return (
    <main className="page-shell page-shell--content animate-fade-in">
      <div className="page-shell-inner">
        <header className="dashboard-page-header">
          <div className="dashboard-page-header-text">
            <h1 className="text-page-title">Manage listings</h1>
            <p className="text-lead dashboard-page-lead">
              Track installs, finish setup for free dofollow links, and boost discovery when you&apos;re ready.
            </p>
          </div>
          <div className="dashboard-page-header-actions">
            <a href="/browse" className="btn btn-secondary">
              Browse to claim
            </a>
            <a href="/submit" className="btn btn-primary">
              + Submit server
            </a>
          </div>
        </header>
        <DashboardClient
          initialServers={ownedServers as any}
          initialAnalytics={analytics}
          categoryRanks={categoryRanks}
          isPremium={isPremium}
          initialEditId={edit ?? null}
        />
      </div>
    </main>
  );
}
