import type { MetadataRoute } from 'next';
import { BEST_TOPICS } from '../lib/bestTopics';
import { getAllPosts } from '../lib/blog';
import { categorySlug, DIRECTORY_CATEGORIES } from '../lib/categories';
import { MCP_CLIENTS } from '../lib/clients';
import { comparePath, INDEXABLE_COMPARE_PAIRS } from '../lib/comparePairs';
import {
  getHubCounts,
  isBestTopicIndexable,
  isCategoryHubIndexable,
} from '../lib/hubIndexability';
import { WORKFLOW_PROMPTS } from '../lib/prompts';
import {
  categoryLastMod,
  getSitemapSummary,
  type SitemapSummary,
  STATIC_PAGE_LASTMOD,
  safeDateISO,
} from '../lib/sitemapHelpers';
import { getAllTagsWithCounts } from '../lib/tags';

const BASE = 'https://allmcps.com';

// Rendered per request, with the underlying D1 read cached for an hour in
// `getSitemapSummary` (see lib/sitemapHelpers.ts). This deliberately isn't ISR:
// a revalidate-based sitemap is prerendered at build time, where there's no D1
// binding, so every deploy froze a fallback-shaped sitemap into the cache until
// the first revalidation. Crawlers still don't re-scan D1 on each hit — the
// cache sits on the query rather than on the rendered XML.
export const dynamic = 'force-dynamic';

/** Named sitemap shards so GSC/Bing can prioritize core + listings first. */
export async function generateSitemaps() {
  return [{ id: 'core' }, { id: 'listings' }, { id: 'secondary' }];
}

function staticEntry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
): MetadataRoute.Sitemap[number] {
  const lastMod = STATIC_PAGE_LASTMOD[path] ?? '2026-08-01';
  return {
    url: path === '/' ? BASE : `${BASE}${path}`,
    lastModified: safeDateISO(lastMod),
    changeFrequency,
    priority,
  };
}

async function buildCoreSitemap(
  summary: SitemapSummary,
): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    staticEntry('/', 'hourly', 1),
    staticEntry('/browse', 'hourly', 0.95),
    staticEntry('/categories', 'daily', 0.9),
    staticEntry('/best', 'weekly', 0.9),
    staticEntry('/clients', 'weekly', 0.9),
    staticEntry('/about', 'monthly', 0.8),
    staticEntry('/docs/api', 'weekly', 0.85),
    staticEntry('/blog', 'weekly', 0.85),
    staticEntry('/contact', 'monthly', 0.6),
    staticEntry('/submit', 'weekly', 0.8),
    staticEntry('/terms', 'yearly', 0.3),
    staticEntry('/privacy', 'yearly', 0.3),
    staticEntry('/guides', 'monthly', 0.9),
    staticEntry('/what-is-mcp', 'monthly', 0.9),
    staticEntry('/guide', 'monthly', 0.9),
    staticEntry('/build-mcp-server', 'monthly', 0.9),
    staticEntry('/mcp-security', 'monthly', 0.9),
    staticEntry('/deploy-mcp-server', 'monthly', 0.9),
    staticEntry('/mcp-troubleshooting', 'monthly', 0.9),
    staticEntry('/mcp-protocol-versioning', 'monthly', 0.9),
    staticEntry('/mcp-transports', 'monthly', 0.9),
    staticEntry('/state-of-mcp', 'weekly', 0.9),
    staticEntry('/pricing', 'monthly', 0.7),
    staticEntry('/tools', 'monthly', 0.9),
    staticEntry('/tools/openapi-to-mcp', 'monthly', 0.9),
    staticEntry('/tools/protocol-inspector', 'monthly', 0.9),
    staticEntry('/tools/config-generator', 'monthly', 0.8),
    staticEntry('/tools/config-validator', 'monthly', 0.8),
    staticEntry('/tools/token-calculator', 'monthly', 0.8),
    staticEntry('/tools/config-auditor', 'monthly', 0.85),
    staticEntry('/tools/playground', 'monthly', 0.85),
    staticEntry('/prompts', 'weekly', 0.9),
    staticEntry('/badge-generator', 'monthly', 0.75),
    staticEntry('/mcp-for-cursor', 'weekly', 0.9),
    staticEntry('/mcp-for-claude-desktop', 'weekly', 0.9),
    staticEntry('/mcp-for-windsurf', 'weekly', 0.9),
    staticEntry('/mcp-for-cline', 'weekly', 0.9),
    staticEntry('/mcp-for-seo', 'weekly', 0.9),
    staticEntry('/trust', 'weekly', 0.85),
    staticEntry('/stack', 'weekly', 0.9),
    staticEntry('/compare', 'weekly', 0.9),
    staticEntry('/tags', 'weekly', 0.9),
    staticEntry('/lucky', 'daily', 0.9),
    staticEntry('/advertise', 'weekly', 0.85),
  ];

  // Blog posts — real publish dates
  try {
    const posts = getAllPosts();
    for (const post of posts) {
      entries.push({
        url: `${BASE}/blog/${post.slug}`,
        lastModified: safeDateISO(
          post.date ? `${post.date}T12:00:00.000Z` : undefined,
        ),
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  } catch (e) {
    console.error('Failed to read blog posts for sitemap', e);
  }

  // Thin hubs are noindexed by their pages (lib/hubIndexability.ts); never submit them.
  const hubCounts = await getHubCounts();

  // Category hubs — lastmod from newest listing activity in that category
  for (const category of DIRECTORY_CATEGORIES) {
    if (!isCategoryHubIndexable(category, hubCounts)) continue;
    entries.push({
      url: `${BASE}/categories/${categorySlug(category)}`,
      // Listings with no category count under 'other'.
      lastModified: categoryLastMod(
        summary,
        (cat) => (cat || 'other') === category,
      ),
      changeFrequency: 'daily',
      priority: 0.85,
    });
  }

  // Best-of topics
  const seenBest = new Set<string>();
  for (const t of BEST_TOPICS) {
    if (seenBest.has(t.slug)) continue;
    seenBest.add(t.slug);
    if (!isBestTopicIndexable(t, hubCounts)) continue;
    const inTopic = (cat: string) => categorySlug(cat) === t.categorySlug;
    const hasListings =
      Boolean(t.categorySlug) &&
      Object.keys(summary.categoryLastMs).some(inTopic);
    entries.push({
      url: `${BASE}/best/${t.slug}`,
      lastModified: hasListings
        ? categoryLastMod(summary, inTopic)
        : safeDateISO(
            STATIC_PAGE_LASTMOD[`/best/${t.slug}`] ??
              STATIC_PAGE_LASTMOD['/best'],
          ),
      changeFrequency: 'weekly',
      priority: 0.85,
    });
  }

  for (const c of MCP_CLIENTS) {
    entries.push({
      url: `${BASE}/clients/${c.slug}`,
      lastModified: safeDateISO(
        STATIC_PAGE_LASTMOD[`/clients/${c.slug}`] ??
          STATIC_PAGE_LASTMOD['/clients'],
      ),
      changeFrequency: 'weekly',
      priority: 0.85,
    });
  }

  for (const w of WORKFLOW_PROMPTS) {
    entries.push({
      url: `${BASE}/prompts/${w.slug}`,
      lastModified: safeDateISO(STATIC_PAGE_LASTMOD['/prompts']),
      changeFrequency: 'weekly',
      priority: 0.85,
    });
  }

  // Tag hubs that rank enough indexable listings (lib/tags.ts isTagIndexable,
  // the same rule as the page's robots meta, so we never submit a noindexed URL).
  try {
    const tagLastMod = safeDateISO(STATIC_PAGE_LASTMOD['/tags']);
    const tags = await getAllTagsWithCounts();
    for (const t of tags) {
      if (!t.indexable) continue;
      entries.push({
        url: `${BASE}/tags/${t.slug}`,
        lastModified: tagLastMod,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  } catch (e) {
    console.error('Failed to build tag sitemap entries', e);
  }

  return entries;
}

function buildListingsSitemap(summary: SitemapSummary): MetadataRoute.Sitemap {
  // Already filtered to the listings the page itself leaves indexable (see
  // createSitemapSummarizer and /mcp/[id] metadata).
  return summary.listings.map((listing) => ({
    url: `${BASE}/mcp/${listing.id}`,
    lastModified: listing.lastmod,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));
}

function buildSecondarySitemap(summary: SitemapSummary): MetadataRoute.Sitemap {
  // Programmatic vs / comparison pages and alternatives pages are kept navigable
  // on-site but noindexed to avoid Google's Scaled Content Abuse penalties for large
  // programmatic matrix doorways. The only exception is the small curated set in
  // lib/comparePairs.ts, submitted under the same condition the page uses to
  // allow indexing (both listings active with a writeup).
  const entries: MetadataRoute.Sitemap = [];
  for (const pair of INDEXABLE_COMPARE_PAIRS) {
    const lastA = summary.comparePairLastMod[pair.a];
    const lastB = summary.comparePairLastMod[pair.b];
    if (!lastA || !lastB) continue;
    entries.push({
      url: `${BASE}${comparePath(pair)}`,
      lastModified: lastA > lastB ? lastA : lastB,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }
  return entries;
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const summary = await getSitemapSummary();

  if (id === 'core') return await buildCoreSitemap(summary);
  if (id === 'listings') return buildListingsSitemap(summary);
  if (id === 'secondary') return buildSecondarySitemap(summary);

  // Unknown shard — return empty rather than mixing priorities.
  return [];
}
