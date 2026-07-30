import type { Metadata } from 'next';
import DirectoryGrid from '../components/DirectoryGrid';
import { redirect } from 'next/navigation';
import { pickDiscoveryServers } from '../lib/featured';
import { getActiveServers } from '../lib/servers';

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

  const servers = await getActiveServers();

  // Newest-first so the landing slice below surfaces the most recent listings.
  const toTime = (v: unknown): number => {
    const t = new Date(v as string | number | Date).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  servers.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));

  // Prune initialServers for landing page to keep HTML payload lightweight (~50KB instead of 2.65MB)
  // so external AI scrapers & submission platforms do not hit response size limit errors
  const landingServers = servers.slice(0, 48);

  // Prefer premium / verified / high-engagement for discovery chrome
  // Seed changes every 5 minutes so different visitors see different featured servers
  const discoverySeed = Math.floor(Date.now() / (5 * 60 * 1000));
  const { marquee: marqueeServers, featured: featuredCards } = pickDiscoveryServers(servers, {
    marquee: 15,
    featured: 3,
    seed: discoverySeed,
  });

  return (
    <main>
      <DirectoryGrid
        initialServers={landingServers}
        marqueeServers={marqueeServers}
        featuredCards={featuredCards}
        variant="landing"
        totalCount={servers.length}
      />
    </main>
  );
}
