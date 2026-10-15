import type { Metadata } from 'next';
import { serializeJsonLd } from '@/lib/jsonLd';
import { FeaturedServers, HeroFeatured } from '../components/FeaturedCards';
import { HeroSection } from '../components/HeroSection';
import {
  LandingCta,
  LandingFaq,
  LandingHowItWorks,
  LandingIntents,
  LandingTrust,
} from '../components/LandingHome';
import { pickDiscoveryServers } from '../lib/featured';
import { isFeaturedListing } from '../lib/featuredStatus';
import {
  getActiveServersLight,
  getShowcaseActiveServers,
} from '../lib/servers';
import { getSiteStats } from '../lib/siteStats';

export const metadata: Metadata = {
  title: {
    absolute: 'AllMCPs — Discover & Install MCP Servers for AI Agents',
  },
  description:
    'Find and install MCP servers for Claude, Cursor, and other AI agents. Search thousands of listings by the job you need done.',
  alternates: {
    canonical: 'https://allmcps.com',
  },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'AllMCPs — Discover & Install MCP Servers for AI Agents',
    description:
      'Find and install MCP servers for Claude, Cursor, and other AI agents. Search thousands of listings by the job you need done.',
    url: 'https://allmcps.com',
    // Page-level `openGraph` fully replaces (doesn't merge with) the root
    // layout's — Next.js metadata merging is shallow per-segment — so `type`
    // has to be repeated here or the homepage silently loses og:type.
    type: 'website',
  },
};

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
  // The discovery pool selects lightweight columns only (see
  // getActiveServersLight) and doubles as the paid-placement source and the
  // fallback; the showcase pool is the quality-ranked curated preview.
  // TEMPORARY diagnostic (2026-10-15): ISR re-renders of / still time out at
  // 25s during cron ticks even with all three loads cached stale-while-
  // revalidate. Log a breakdown when the data phase is slow, to tell a slow
  // load from slowness elsewhere (render, R2 cache write). Remove once known.
  const t0 = Date.now();
  const ms: Record<string, number> = {};
  const timed = <T,>(name: string, p: Promise<T>) =>
    p.finally(() => {
      ms[name] = Date.now() - t0;
    });
  const [showcaseServers, discoveryPool, siteStats] = await Promise.all([
    timed('showcase', getShowcaseActiveServers(8)),
    timed('discovery', getActiveServersLight(200)),
    timed('siteStats', getSiteStats()),
  ]);
  if (Date.now() - t0 > 5000) {
    console.warn('[home] slow data phase (ms)', JSON.stringify(ms));
  }
  // discoveryPool is capped at 200 rows for ranking, so its length is not the
  // catalog size — use the real active-listing count.
  const catalogTotal = Math.max(siteStats.totalServers, discoveryPool.length);

  // Paid/featured listings lead (labeled "Featured" on the card), then the
  // showcase ranking (logo, health, docs, adoption). Engagement-ranked
  // discovery picks only top up the grid when the showcase pool is thin, so
  // the section is never empty. The seed rotates every 5 minutes.
  const discoverySeed = Math.floor(Date.now() / (5 * 60 * 1000));
  const { marquee, featured } = pickDiscoveryServers(discoveryPool, {
    marquee: 8,
    featured: 3,
    seed: discoverySeed,
  });
  const seen = new Set<string>();
  const previewServers = [
    ...featured.filter((s) => isFeaturedListing(s)),
    ...showcaseServers,
    ...marquee,
  ]
    .filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .slice(0, 8);

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
    keywords: [
      'Model Context Protocol',
      'MCP servers',
      'AI agents',
      'Claude',
      'Cursor',
    ],
    creator: {
      '@type': 'Organization',
      name: 'AllMCPs',
      url: 'https://allmcps.com',
    },
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

  return (
    <main className="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(datasetJsonLd) }}
      />
      <HeroSection
        totalCount={catalogTotal}
        featuredSlot={<HeroFeatured servers={featured} />}
      />
      {/* Top picks lead with paid featured listings — kept right under the
          hero so they're seen early. */}
      <FeaturedServers servers={previewServers} totalCount={catalogTotal} />
      <LandingIntents />
      <LandingHowItWorks />
      <LandingTrust stats={siteStats} totalCount={catalogTotal} />
      <LandingFaq />
      <LandingCta totalCount={catalogTotal} />
    </main>
  );
}
