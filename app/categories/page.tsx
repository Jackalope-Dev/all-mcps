import { Metadata } from 'next';
import Link from 'next/link';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../../db/schema';
import { eq } from 'drizzle-orm';
import serversData from '../../data/mcp-servers.json';

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Browse Model Context Protocol (MCP) servers by category.',
  alternates: {
    canonical: 'https://allmcps.com/categories',
  },
};

type Server = {
  id: string;
  category: string;
};

async function getCategoryCounts(): Promise<Record<string, number>> {
  let servers = serversData as Server[];

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select({ id: serversTable.id, category: serversTable.category }).from(serversTable).where(eq(serversTable.status, 'active'));
      if (dbServers.length > 0) {
        servers = dbServers as unknown as Server[];
      }
    }
  } catch (e) {}

  const counts: Record<string, number> = {};
  for (const s of servers) {
    if (s.category) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
  }

  return counts;
}

export default async function CategoriesPage() {
  const categoryCounts = await getCategoryCounts();
  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  return (
    <main className="container" style={{ padding: '6rem 0 8rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>Browse Categories</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto' }}>
          Explore Model Context Protocol servers grouped by capabilities and integrations.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {sortedCategories.map(([cat, count]) => (
          <Link 
            href={`/?category=${encodeURIComponent(cat)}`} 
            key={cat} 
            className="glass-panel card-hoverable" 
            style={{ 
              padding: '2rem', 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'space-between',
              textDecoration: 'none',
              color: 'inherit',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>{cat}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {count} {count === 1 ? 'tool' : 'tools'} available
              </p>
            </div>
            <div style={{ marginTop: '1.5rem', color: 'var(--accent-color)', fontSize: '0.875rem', fontWeight: 500 }}>
              Explore category &rarr;
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
