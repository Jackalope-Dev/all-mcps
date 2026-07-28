import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { servers } from '@/db/schema';
import { auth } from '@/lib/auth';
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

async function getOwnedServers(userId: string) {
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
        })
        .from(servers)
        .where(eq(servers.ownerUserId, userId));
      return rows;
    }
  } catch {
    // fall through with an empty list
  }
  return [];
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard');
  }

  const ownedServers = await getOwnedServers(session.user.id);

  return (
    <main className="page-shell page-shell--content animate-fade-in">
      <div className="page-shell-inner">
        <header className="page-header">
          <h1 className="text-page-title">My listings</h1>
          <p className="text-lead">Edits go live after a quick review.</p>
        </header>
        <DashboardClient initialServers={ownedServers as any} />
      </div>
    </main>
  );
}
