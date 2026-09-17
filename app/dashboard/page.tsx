import { eq, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { servers, sponsorAds } from '@/db/schema';
import { parseStringArray } from '@/lib/aiContent';
import {
  type AnalyticsSummary,
  getServerAnalyticsBatch,
} from '@/lib/analytics';
import { auth } from '@/lib/auth';
import DashboardClient from './DashboardClient';

export type OwnedAd = {
  id: string;
  title: string;
  description: string;
  placement: string;
  status: string;
  bidCpm: number;
  totalImpressionsPurchased: number;
  impressionsServed: number;
  clicksCount: number;
  stripePaymentIntentId: string | null;
  stripeInvoiceUrl: string | null;
  createdAt: Date;
};

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
  screenshotUrl?: string | null;
  pendingScreenshotKey?: string | null;
  isPremium: boolean;
  status: string;
  featuredUntil: Date | null;
  categorySponsorUntil: Date | null;
  isOfficial: boolean;
  reciprocalBadgeOk: boolean;
  websiteBacklinkOk: boolean;
  views: number;
  copies: number;
  upvotes: number;
  healthStatus?: string | null;
  isVerifiedActive?: boolean | null;
  githubStars?: number | null;
  npmDownloads?: number | null;
  tools?: string | null;
  url?: string | null;
  tags?: string[] | null;
  pricingModel?: string | null;
  pricingNotes?: string | null;
  authType?: string | null;
  license?: string | null;
  compatibleClients?: string[] | null;
  maintenanceStatus?: string | null;
  supportUrl?: string | null;
  suggestedInstallCommand?: string | null;
  suggestedInstallArgs?: string[] | null;
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
          isOfficial: servers.isOfficial,
          reciprocalBadgeOk: servers.reciprocalBadgeOk,
          websiteBacklinkOk: servers.websiteBacklinkOk,
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
      const categoryRanks: Record<
        string,
        { rank: number; totalInCategory: number }
      > = {};
      for (const server of rows) {
        try {
          const categoryList = await db
            .select({ id: servers.id })
            .from(servers)
            .where(
              and(
                eq(servers.category, server.category),
                eq(servers.status, 'active'),
              ),
            )
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

      return {
        servers: normalized as OwnedServer[],
        analytics,
        categoryRanks,
        isPremium,
      };
    }
  } catch {
    // fall through with empty list
  }
  return { servers: [], analytics: {}, categoryRanks: {}, isPremium: false };
}

async function getOwnedAds(
  userId: string,
  email: string | null | undefined,
): Promise<OwnedAd[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (!ctx?.env || !(ctx.env as any).DB) return [];

    const db = drizzle((ctx.env as any).DB);
    const normalizedEmail = email ? email.trim().toLowerCase() : null;

    const rows = await db
      .select({
        id: sponsorAds.id,
        title: sponsorAds.title,
        description: sponsorAds.description,
        placement: sponsorAds.placement,
        status: sponsorAds.status,
        bidCpm: sponsorAds.bidCpm,
        totalImpressionsPurchased: sponsorAds.totalImpressionsPurchased,
        impressionsServed: sponsorAds.impressionsServed,
        clicksCount: sponsorAds.clicksCount,
        stripePaymentIntentId: sponsorAds.stripePaymentIntentId,
        stripeInvoiceUrl: sponsorAds.stripeInvoiceUrl,
        createdAt: sponsorAds.createdAt,
      })
      .from(sponsorAds)
      .where(
        normalizedEmail
          ? or(
              eq(sponsorAds.advertiserUserId, userId),
              eq(sponsorAds.advertiserEmail, normalizedEmail),
            )
          : eq(sponsorAds.advertiserUserId, userId),
      );

    return rows;
  } catch {
    return [];
  }
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

  const [
    { servers: ownedServers, analytics, categoryRanks, isPremium },
    ownedAds,
  ] = await Promise.all([
    getOwnedServers(session.user.id),
    getOwnedAds(session.user.id, session.user.email),
  ]);
  const { edit } = await searchParams;

  return (
    <main className="page-shell page-shell--content animate-fade-in">
      <div className="page-shell-inner">
        <header className="dashboard-page-header">
          <div className="dashboard-page-header-text">
            <h1 className="text-page-title">Manage listings</h1>
            <p className="text-lead dashboard-page-lead">
              {ownedAds.length > 0
                ? 'Track installs, finish setup for free dofollow links, boost discovery, and manage your sponsor ad campaigns — all in one place.'
                : "Track installs, finish setup for free dofollow links, and boost discovery when you're ready."}
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
          initialAds={ownedAds}
        />
      </div>
    </main>
  );
}
