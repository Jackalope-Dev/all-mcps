import type { Metadata } from 'next';
import DirectoryGrid from '../components/DirectoryGrid';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../db/schema';
import { desc, eq } from 'drizzle-orm';
import serversData from '../data/mcp-servers.json';
import { redirect } from 'next/navigation';
import { pickDiscoveryServers } from '../lib/featured';

export const metadata: Metadata = {
  title: 'AllMCPs - Discover & Install MCP Servers for AI Agents',
  description:
    'Find, discover, and install the best Model Context Protocol (MCP) servers. Connect Claude, Cursor, and AI agents to files, databases, and APIs.',
  alternates: {
    canonical: 'https://allmcps.com',
  },
  openGraph: {
    title: 'AllMCPs - Discover & Install MCP Servers for AI Agents',
    description:
      'Find, discover, and install the best Model Context Protocol (MCP) servers. Connect Claude, Cursor, and AI agents to files, databases, and APIs.',
    url: 'https://allmcps.com',
  },
};

// Define the type for our server data
type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
  isPremium?: boolean;
  views?: number;
  copies?: number;
  upvotes?: number;
  createdAt?: string;
};

// Fetch data from local JSON or D1
async function getServers(): Promise<Server[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db
        .select()
        .from(serversTable)
        .where(eq(serversTable.status, 'active'))
        .orderBy(desc(serversTable.createdAt));
      return dbServers as unknown as Server[];
    }
  } catch (e) {
    // Fallback to local JSON if not running in wrangler / opennext
  }

  return serversData as Server[];
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  // Filtered / search views live on the dedicated browse page
  const category = typeof params.category === 'string' ? params.category : null;
  const q = typeof params.q === 'string' ? params.q : '';
  if (category || q) {
    const sp = new URLSearchParams();
    if (category) sp.set('category', category);
    if (q) sp.set('q', q);
    redirect(`/browse?${sp.toString()}`);
  }

  const servers = await getServers();

  // Prefer premium / verified / high-engagement for discovery chrome
  const { marquee: marqueeServers, featured: featuredCards } = pickDiscoveryServers(servers, {
    marquee: 15,
    featured: 3,
  });

  return (
    <main>
      <DirectoryGrid
        initialServers={servers}
        marqueeServers={marqueeServers}
        featuredCards={featuredCards}
        variant="landing"
      />
    </main>
  );
}
