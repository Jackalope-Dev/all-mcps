import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import ClaimClient from './ClaimClient';
import serversData from '../../../../data/mcp-servers.json';
import { auth } from '../../../../lib/auth';
import { parseServerName } from '../../../../lib/displayName';
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
  if (!server) return { title: 'Claim listing', robots: { index: false } };
  const { displayName } = parseServerName(server.name);
  const name = displayName.length > 40 ? `${displayName.slice(0, 39).trimEnd()}…` : displayName;
  return {
    title: `Claim ${name}`,
    description: `Verify ownership of ${name} on AllMCPs via GitHub README, site badge, or DNS.`,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    notFound();
  }

  const session = await auth();
  const { displayName } = parseServerName(server.name);

  return (
    <main className="page-shell page-shell--content animate-fade-in">
      <div className="page-shell-inner">
        <header className="page-header" style={{ textAlign: 'center' }}>
          <h1 className="text-page-title">Claim {displayName}</h1>
          <p className="text-lead" style={{ margin: '0 auto', textAlign: 'center' }}>
            Prove you own this MCP to unlock the verified badge, attach your website, and qualify for premium dofollow
            backlinks.
          </p>
        </header>
        <ClaimClient
          serverId={server.id}
          serverName={server.name}
          repoUrl={server.url}
          websiteUrl={(server as any).websiteUrl}
          isOfficial={(server as any).isOfficial}
          websiteVerified={(server as any).websiteVerified}
          userId={session?.user?.id ?? null}
        />
      </div>
    </main>
  );
}
