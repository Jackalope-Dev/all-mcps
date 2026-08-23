import type { Metadata } from 'next';
import DirectoryGrid from '../components/DirectoryGrid';
import { pickDiscoveryServers } from '../lib/featured';
import { getActiveServersLight, getNewestActiveServers, type Server } from '../lib/servers';
import { getSiteStats } from '../lib/siteStats';
import { buildAiSearchText } from '../lib/search';

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
    images: [{ url: 'https://allmcps.com/opengraph-image', width: 1200, height: 630, alt: 'AllMCPs' }],
    title: 'AllMCPs — Discover & Install MCP Servers for AI Agents',
    description:
      'Find, discover, and install the best Model Context Protocol (MCP) servers. Connect Claude, Cursor, and AI agents to files, databases, and APIs.',
    url: 'https://allmcps.com',
    // Page-level `openGraph` fully replaces (doesn't merge with) the root
    // layout's — Next.js metadata merging is shallow per-segment — so `type`
    // has to be repeated here or the homepage silently loses og:type.
    type: 'website',
  },
};

/**
 * Homepage landing cards only ever render name/description/category/badges/
 * install-snippet/tool-count (see the DirectoryGrid card markup) — never the
 * raw `tools` schema array or the full AI-content fields. `getNewestActiveServers`
 * still selects those heavy columns (other callers need them), so this collapses
 * them into the same compact `toolText`/`toolCount`/`aiText` shape the lazy
 * /browse feed already uses before they ever reach the client, instead of
 * shipping the full tool-schema/AI-content JSON into the homepage's initial
 * hydration payload for 48 listings just to leave it unread.
 */
function toLightCard(s: Server) {
  const tools = s.tools || [];
  const {
    tools: _tools,
    aiSummary: _aiSummary,
    aiOverview: _aiOverview,
    aiUseCases: _aiUseCases,
    aiFeatures: _aiFeatures,
    aiFaq: _aiFaq,
    aiEnvVars: _aiEnvVars,
    ...rest
  } = s;
  return {
    ...rest,
    toolText: tools.map((t) => t.name).join(' ') || null,
    toolCount: tools.length,
    aiText: buildAiSearchText(
      {
        aiSummary: s.aiSummary,
        aiOverview: s.aiOverview,
        aiUseCases: s.aiUseCases,
        aiFeatures: s.aiFeatures,
        aiFaq: s.aiFaq,
        tags: s.tags,
        license: s.license,
        pricingModel: s.pricingModel,
        authType: s.authType,
        compatibleClients: s.compatibleClients,
      },
      400
    ),
  };
}

// 5-minute ISR aligns with the 5-min discovery seed rotation while serving
// sub-15ms Edge CDN response times for root homepage visitors.
export const revalidate = 300;

// `?category=`/`?q=` on `/` used to be handled by reading `searchParams` here and
// redirecting to /browse — but merely reading that prop (even to find it empty,
// which is true for virtually all real homepage traffic) forces Next to render
// this whole page dynamically, defeating the ISR caching below for every visitor.
// The redirect now happens in middleware.ts instead, before Next's rendering
// pipeline is even involved, so this page never touches searchParams and stays
// eligible for the `revalidate` caching below.
export default async function Home() {
  // Landing cards (full detail, DB-sorted+capped) and the catalog-wide ranking
  // pool (lightweight columns only — see getActiveServersLight) are independent
  // queries so a homepage hit never has to load every listing's tools/AI-content
  // into memory just to pick ~20 marquee/featured cards out of thousands.
  const [newestServers, discoveryPool, siteStats] = await Promise.all([
    getNewestActiveServers(48),
    getActiveServersLight(),
    getSiteStats(),
  ]);
  const landingServers = newestServers.map(toLightCard);

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

