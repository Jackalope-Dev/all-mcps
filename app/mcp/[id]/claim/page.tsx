import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import ClaimClient from './ClaimClient';
import serversData from '../../../../data/mcp-servers.json';
import type { Metadata } from 'next';

async function getServer(id: string) {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
      if (dbServers.length > 0) return dbServers[0];
    }
  } catch (e) {}

  const allServers = serversData as {
    id: string;
    name: string;
    url: string;
    websiteUrl?: string;
    isOfficial?: boolean;
    websiteVerified?: boolean;
  }[];
  return allServers.find((s) => s.id === id);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const server = await getServer(id);
  if (!server) return { title: 'Claim listing' };
  return {
    title: `Claim ${server.name}`,
    description: `Verify ownership of ${server.name} on AllMCPs via GitHub README, site badge, or DNS.`,
  };
}

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    notFound();
  }

  return (
    <main className="container animate-fade-in" style={{ padding: '4rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.75rem', textAlign: 'center' }}>Claim this listing</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '36rem', marginInline: 'auto' }}>
        Prove you own this MCP to unlock the verified badge, attach your website, and qualify for premium dofollow backlinks.
      </p>
      <ClaimClient
        serverId={server.id}
        serverName={server.name}
        repoUrl={server.url}
        websiteUrl={(server as any).websiteUrl}
        isOfficial={(server as any).isOfficial}
        websiteVerified={(server as any).websiteVerified}
      />
    </main>
  );
}
