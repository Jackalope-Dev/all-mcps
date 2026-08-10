import type { MetadataRoute } from 'next';
import { getAllPosts } from '../lib/blog';
import { DIRECTORY_CATEGORIES, categorySlug } from '../lib/categories';
import { BEST_TOPICS } from '../lib/bestTopics';
import { MCP_CLIENTS } from '../lib/clients';
import { WORKFLOW_PROMPTS } from '../lib/prompts';
import { engagementScore } from '../lib/search';
import { relatedRankingScore } from '../lib/servers';
import {
  STATIC_PAGE_LASTMOD,
  getSitemapServers,
  listingLastMod,
  maxServerLastMod,
  safeDateISO,
  type SitemapServer,
} from '../lib/sitemapHelpers';

const BASE = 'https://allmcps.com';

/** Named sitemap shards so GSC/Bing can prioritize core + listings first. */
export async function generateSitemaps() {
  return [{ id: 'core' }, { id: 'listings' }, { id: 'secondary' }];
}

function staticEntry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number
): MetadataRoute.Sitemap[number] {
  const lastMod = STATIC_PAGE_LASTMOD[path] ?? '2026-08-01';
  return {
    url: path === '/' ? BASE : `${BASE}${path}`,
    lastModified: safeDateISO(lastMod),
    changeFrequency,
    priority,
  };
}

function buildCoreSitemap(servers: SitemapServer[]): MetadataRoute.Sitemap {
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
    staticEntry('/trust', 'weekly', 0.85),
    staticEntry('/stack', 'weekly', 0.9),
    staticEntry('/compare', 'weekly', 0.9),
    staticEntry('/tags', 'weekly', 0.9),
  ];

  // Blog posts — real publish dates
  try {
    const posts = getAllPosts();
    for (const post of posts) {
      entries.push({
        url: `${BASE}/blog/${post.slug}`,
        lastModified: safeDateISO(post.date ? `${post.date}T12:00:00.000Z` : undefined),
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
      lastModified: inCat.length > 0 ? maxServerLastMod(inCat) : safeDateISO(STATIC_PAGE_LASTMOD['/best']),
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

function buildSecondarySitemap(servers: SitemapServer[]): MetadataRoute.Sitemap {
  // Alternatives: indexable but lower priority — don't compete with core + listings.
  const alternatives: MetadataRoute.Sitemap = servers.map((server) => ({
    url: `${BASE}/mcp/${server.id}/alternatives`,
    lastModified: listingLastMod(server),
    changeFrequency: 'weekly' as const,
    priority: 0.45,
  }));

  // Compare pages: top engagement seeds × peers (capped).
  const engagement = (s: SitemapServer) =>
    engagementScore({
      githubStars: s.githubStars ?? s.stars ?? 0,
      npmDownloads: s.npmDownloads ?? s.downloads ?? 0,
      views: s.views ?? 0,
      copies: s.copies ?? 0,
      upvotes: s.upvotes ?? 0,
    });

  const byCategory = new Map<string, SitemapServer[]>();
  for (const s of servers) {
    const cat = s.category || 'other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(s);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => engagement(b) - engagement(a));
  }

  const topSeeds = [...servers].sort((a, b) => engagement(b) - engagement(a)).slice(0, 80);
  const compareSeen = new Set<string>();
  const compareEntries: MetadataRoute.Sitemap = [];

  for (const seed of topSeeds) {
    const candidatePeers = (byCategory.get(seed.category || 'other') || [])
      .filter((p) => p.id !== seed.id);
    
    // Sort peers by semantic similarity & engagement to current seed server
    candidatePeers.sort((a, b) => relatedRankingScore(b as any, seed as any) - relatedRankingScore(a as any, seed as any));
    
    const peers = candidatePeers.slice(0, 3);
    for (const peer of peers) {
      const [a, b] = seed.id < peer.id ? [seed.id, peer.id] : [peer.id, seed.id];
      const key = `${a}|${b}`;
      if (compareSeen.has(key)) continue;
      compareSeen.add(key);
      compareEntries.push({
        url: `${BASE}/mcp/${a}/vs/${b}`,
        lastModified: safeDateISO(
          seed.lastCheckedAt || seed.createdAt || seed.created_at || peer.lastCheckedAt
        ),
        changeFrequency: 'weekly',
        priority: 0.4,
      });
      if (compareEntries.length >= 400) break;
    }
    if (compareEntries.length >= 400) break;
  }

  return [...alternatives, ...compareEntries];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const servers = await getSitemapServers();

  if (id === 'core') return buildCoreSitemap(servers);
  if (id === 'listings') return buildListingsSitemap(servers);
  if (id === 'secondary') return buildSecondarySitemap(servers);

  // Unknown shard — return empty rather than mixing priorities.
  return [];
}
