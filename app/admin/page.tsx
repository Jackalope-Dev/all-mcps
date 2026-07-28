import { headers } from 'next/headers';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { getAuthorizedAdminEmail } from '../../lib/accessAuth';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

async function getPendingServers() {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const pendingServers = await db.select().from(servers).where(eq(servers.status, 'pending'));

      return pendingServers.map(s => ({
        ...s,
        createdAt: s.createdAt.toISOString()
      }));
    }
  } catch (e) {
    // Fallback if not in edge context
  }
  return [];
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

  const pendingServers = await getPendingServers();

  return (
    <main className="container animate-fade-in" style={{ padding: '4rem 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Admin Dashboard</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
        Review and approve pending submissions to the directory. Logged in as {email}.
      </p>

      <AdminClient initialPending={pendingServers as any} />
    </main>
  );
}
