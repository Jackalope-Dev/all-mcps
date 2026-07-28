import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../db/schema';
import { eq } from 'drizzle-orm';
import AdminClient from './AdminClient';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

async function getPendingServers() {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const pendingServers = await db.select().from(servers).where(eq(servers.status, 'pending'));
      
      // Ensure date objects are serialized to strings for the client component
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
  const pendingServers = await getPendingServers();

  return (
    <main className="container animate-fade-in" style={{ padding: '4rem 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Admin Dashboard</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
        Review and approve pending submissions to the directory.
      </p>
      
      <AdminClient initialPending={pendingServers as any} />
    </main>
  );
}
