import type { MetadataRoute } from 'next';
import { BEST_TOPICS } from '../lib/bestTopics';
import { getAllPosts } from '../lib/blog';
import { categorySlug, DIRECTORY_CATEGORIES } from '../lib/categories';
import { MCP_CLIENTS } from '../lib/clients';
import { WORKFLOW_PROMPTS } from '../lib/prompts';
import {
  getSitemapServers,
  listingLastMod,
  maxServerLastMod,
  type SitemapServer,
  STATIC_PAGE_LASTMOD,
  safeDateISO,
} from '../lib/sitemapHelpers';
import { getAllTagsWithCounts } from '../lib/tags';

const BASE = 'https://allmcps.com';

// Crawlers re-fetch the sitemap far more often than the catalog actually changes;
// without this each shard re-scanned D1 from scratch on every single crawl hit.
export const revalidate = 3600;

/** Named sitemap shards so GSC/Bing can prioritize core + listings first. */
export async function generateSitemaps() {
  return [{ id: 'core' }, { id: 'listings' }];
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
  servers: SitemapServer[],
): Promise<MetadataRoute.Sitemap> {
  const byCategory = new Map<string, SitemapServer[]>();
  for (const s of servers) {
    const cat = s.category || 'other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(s);
  }

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

  // Category hubs — lastmod from newest listing activity in that category
  for (const category of DIRECTORY_CATEGORIES) {
    const inCat = byCategory.get(category) || [];
    entries.push({
      url: `${BASE}/categories/${categorySlug(category)}`,
      lastModified: maxServerLastMod(inCat),
      changeFrequency: 'daily',
      priority: 0.85,
    });
  }

  // Best-of topics
  const seenBest = new Set<string>();
  for (const t of BEST_TOPICS) {
    if (seenBest.has(t.slug)) continue;
    seenBest.add(t.slug);
    const inCat = t.categorySlug
      ? servers.filter((s) => categorySlug(s.category || '') === t.categorySlug)
      : [];
    entries.push({
      url: `${BASE}/best/${t.slug}`,
      lastModified:
        inCat.length > 0
          ? maxServerLastMod(inCat)
          : safeDateISO(STATIC_PAGE_LASTMOD['/best']),
      changeFrequency: 'weekly',
      priority: 0.85,
    });
  }

  for (const c of MCP_CLIENTS) {
    entries.push({
      url: `${BASE}/clients/${c.slug}`,
      lastModified: safeDateISO(STATIC_PAGE_LASTMOD['/clients']),
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

  // Curated tag hubs — indexable /tags/[slug] pages with enough servers to carry
  // real value. Without these they were only reachable via the /tags hub and sat
  // in "Discovered - currently not indexed". A floor keeps near-empty tag dumps
  // out; the ceiling must stay <= the noindex threshold in app/tags/[slug]/page.tsx
  // (currently >200 → noindex) so we never submit a noindexed URL.
  try {
    const TAG_MIN_COUNT = 15;
    const TAG_MAX_COUNT = 200;
    const tagLastMod = safeDateISO(STATIC_PAGE_LASTMOD['/tags']);
    const tags = await getAllTagsWithCounts();
    for (const t of tags) {
      if (t.count < TAG_MIN_COUNT || t.count > TAG_MAX_COUNT) continue;
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

function buildListingsSitemap(servers: SitemapServer[]): MetadataRoute.Sitemap {
  return servers.map((server) => ({
    url: `${BASE}/mcp/${server.id}`,
    lastModified: listingLastMod(server),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));
}

function buildSecondarySitemap(
  _servers: SitemapServer[],
): MetadataRoute.Sitemap {
  // Programmatic vs / comparison pages and alternatives pages are kept navigable
  // on-site but noindexed to avoid Google's Scaled Content Abuse penalties for large
  // programmatic matrix doorways. They are not submitted in sitemaps.
  return [];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const servers = await getSitemapServers();

  if (id === 'core') return await buildCoreSitemap(servers);
  if (id === 'listings') return buildListingsSitemap(servers);
  if (id === 'secondary') return buildSecondarySitemap(servers);

  // Unknown shard — return empty rather than mixing priorities.
  return [];
}
