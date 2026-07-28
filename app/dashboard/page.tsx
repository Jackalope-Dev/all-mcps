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
  isPremium: boolean;
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
          isPremium: servers.isPremium,
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

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard');
  }

  const { servers: ownedServers, analytics, isPremium } = await getOwnedServers(session.user.id);

  return (
    <main className="page-shell page-shell--content animate-fade-in">
      <div className="page-shell-inner">
        <header className="page-header">
          <h1 className="text-page-title">My listings</h1>
          <p className="text-lead">Edits go live after a quick review.</p>
        </header>
        <DashboardClient
          initialServers={ownedServers as any}
          initialAnalytics={analytics}
          isPremium={isPremium}
        />
      </div>
    </main>
  );
}
