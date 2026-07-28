import { headers } from 'next/headers';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthorizedAdminEmail } from '../../lib/accessAuth';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

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
      const activeServers = await db
        .select()
        .from(servers)
        .where(eq(servers.status, 'active'))
        .orderBy(desc(servers.createdAt))
        .limit(50);

      const map = (s: typeof pendingServers[0]) => ({
        ...s,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
      });

      return {
        pending: pendingServers.map(map),
        active: activeServers.map(map),
      };
    }
  } catch (e) {
    // Fallback if not in edge context
  }
  return { pending: [], active: [] };
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

  const { pending, active } = await getAdminData();

  return (
    <main className="container animate-fade-in" style={{ padding: '4rem 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Admin Dashboard</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
        Review submissions and manage premium (dofollow) listings. Logged in as {email}.
      </p>

      <AdminClient initialPending={pending as any} initialActive={active as any} />
    </main>
  );
}
