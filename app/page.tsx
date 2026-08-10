import type { Metadata } from 'next';
import DirectoryGrid from '../components/DirectoryGrid';
import { redirect } from 'next/navigation';
import { pickDiscoveryServers } from '../lib/featured';
import { getActiveServersLight, getNewestActiveServers } from '../lib/servers';
import { getSiteStats } from '../lib/siteStats';

export const metadata: Metadata = {
  title: {
    absolute: 'AllMCPs — Discover & Install MCP Servers for AI Agents',
  },
  description:
    'Find, discover, and install the best Model Context Protocol (MCP) servers. Connect Claude, Cursor, and AI agents to files, databases, and APIs.',
  alternates: {
    canonical: 'https://allmcps.com',
  },
  openGraph: {
    title: 'AllMCPs — Discover & Install MCP Servers for AI Agents',
    description:
      'Find, discover, and install the best Model Context Protocol (MCP) servers. Connect Claude, Cursor, and AI agents to files, databases, and APIs.',
    url: 'https://allmcps.com',
  },
// 5-minute ISR aligns with the 5-min discovery seed rotation while serving
// sub-15ms Edge CDN response times for root homepage visitors.
export const revalidate = 300;

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

  // Landing cards (full detail, DB-sorted+capped) and the catalog-wide ranking
  // pool (lightweight columns only — see getActiveServersLight) are independent
  // queries so a homepage hit never has to load every listing's tools/AI-content
  // into memory just to pick ~20 marquee/featured cards out of thousands.
  const [landingServers, discoveryPool, siteStats] = await Promise.all([
    getNewestActiveServers(48),
    getActiveServersLight(),
    getSiteStats(),
  ]);

  // Prefer premium / verified / high-engagement for discovery chrome
  // Seed changes every 5 minutes so different visitors see different featured servers
  const discoverySeed = Math.floor(Date.now() / (5 * 60 * 1000));
  const { marquee: marqueeServers, featured: featuredCards } = pickDiscoveryServers(discoveryPool, {
    marquee: 15,
    featured: 3,
    seed: discoverySeed,
  });

  // Advertise the machine-readable catalog export so agents/answer engines can
  // discover /data.json as a citable structured data source.
  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'AllMCPs — Model Context Protocol Server Directory',
    description:
      'Structured export of every active MCP (Model Context Protocol) server on AllMCPs, with categories, descriptions, install identifiers, and directory links.',
    url: 'https://allmcps.com',
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
    keywords: ['Model Context Protocol', 'MCP servers', 'AI agents', 'Claude', 'Cursor'],
    creator: { '@type': 'Organization', name: 'AllMCPs', url: 'https://allmcps.com' },
    isAccessibleForFree: true,
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: 'https://allmcps.com/data.json',
      },
      {
        '@type': 'DataDownload',
        encodingFormat: 'text/markdown',
        contentUrl: 'https://allmcps.com/llms-full.txt',
      },
    ],
  };

  // Compute full category counts across the entire catalog for homepage cards & filters
  const fullCategoryCounts: Record<string, number> = {};
  for (const s of discoveryPool) {
    if (s.category) {
      fullCategoryCounts[s.category] = (fullCategoryCounts[s.category] || 0) + 1;
    }
  }

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />
      <DirectoryGrid
        initialServers={landingServers}
        marqueeServers={marqueeServers}
        featuredCards={featuredCards}
        variant="landing"
        totalCount={discoveryPool.length}
        siteStats={siteStats}
        fullCategoryCounts={fullCategoryCounts}
      />
    </main>
  );
}

