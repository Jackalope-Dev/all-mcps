import { cache } from 'react';
import { parseCategoryLabel } from './categories';
import { swrEdgeCache } from './edgeCache';
import { engagementScore } from './search';
import {
  hydrateServersByIds,
  iterateActiveServersLight,
  type Server,
} from './servers';

function slugifyTag(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Known technology and topic keywords to extract from server metadata */
const TECH_KEYWORDS: { slug: string; label: string; pattern: RegExp }[] = [
  { slug: 'github', label: 'GitHub', pattern: /\b(github|git)\b/i },
  {
    slug: 'postgres',
    label: 'PostgreSQL',
    pattern: /\b(postgres|postgresql|pg)\b/i,
  },
  { slug: 'sqlite', label: 'SQLite', pattern: /\b(sqlite|sqlite3)\b/i },
  { slug: 'mysql', label: 'MySQL', pattern: /\b(mysql|mariadb)\b/i },
  { slug: 'redis', label: 'Redis', pattern: /\b(redis|valkey)\b/i },
  { slug: 'mongodb', label: 'MongoDB', pattern: /\b(mongodb|mongo)\b/i },
  { slug: 'supabase', label: 'Supabase', pattern: /\b(supabase)\b/i },
  { slug: 'slack', label: 'Slack', pattern: /\b(slack)\b/i },
  { slug: 'discord', label: 'Discord', pattern: /\b(discord)\b/i },
  { slug: 'notion', label: 'Notion', pattern: /\b(notion)\b/i },
  { slug: 'figma', label: 'Figma', pattern: /\b(figma)\b/i },
  { slug: 'linear', label: 'Linear', pattern: /\b(linear)\b/i },
  { slug: 'jira', label: 'Jira', pattern: /\b(jira|atlassian)\b/i },
  {
    slug: 'docker',
    label: 'Docker',
    pattern: /\b(docker|container|containers)\b/i,
  },
  { slug: 'kubernetes', label: 'Kubernetes', pattern: /\b(k8s|kubernetes)\b/i },
  { slug: 'python', label: 'Python', pattern: /\b(python|pip|pipx|pytest)\b/i },
  {
    slug: 'typescript',
    label: 'TypeScript',
    pattern: /\b(typescript|ts|node|npm|npx)\b/i,
  },
  {
    slug: 'browser-automation',
    label: 'Browser Automation',
    pattern: /\b(browser|puppeteer|playwright|selenium)\b/i,
  },
  {
    slug: 'vector-db',
    label: 'Vector DB',
    pattern: /\b(vector|pinecone|chroma|qdrant|weaviate|milvus)\b/i,
  },
  { slug: 'seo', label: 'SEO', pattern: /\b(seo|sitemap|robots\.txt)\b/i },
  {
    slug: 'email',
    label: 'Email',
    pattern: /\b(email|gmail|sendgrid|resend|imap|smtp)\b/i,
  },
  {
    slug: 'audio-speech',
    label: 'Audio & Speech',
    pattern: /\b(audio|speech|tts|whisper|voice)\b/i,
  },
  { slug: 'video', label: 'Video', pattern: /\b(video|ffmpeg|youtube)\b/i },
  {
    slug: 'image-processing',
    label: 'Image Processing',
    pattern: /\b(image|images|screenshot|canvas)\b/i,
  },
  {
    slug: 'filesystem-storage',
    label: 'Filesystem & Storage',
    pattern: /\b(filesystem|files|storage|s3|drive)\b/i,
  },
  {
    slug: 'weather',
    label: 'Weather',
    pattern: /\b(weather|forecast|meteo)\b/i,
  },
  {
    slug: 'crypto-web3',
    label: 'Crypto & Web3',
    pattern: /\b(crypto|blockchain|ethereum|solana|bitcoin|web3)\b/i,
  },
  {
    slug: 'calendar',
    label: 'Calendar',
    pattern: /\b(calendar|gcal|scheduling)\b/i,
  },
  { slug: 'obsidian', label: 'Obsidian', pattern: /\b(obsidian)\b/i },
  {
    slug: 'auth',
    label: 'Auth & OAuth',
    pattern: /\b(auth|oauth|jwt|authentication)\b/i,
  },
];

/** Extract all matching tag objects ({ slug, label }) for a server */
function extractTagsForServer(
  server: Server,
): { slug: string; label: string }[] {
  const map = new Map<string, string>();

  // 1. Explicit server tags
  const tags = Array.isArray(server.tags) ? server.tags : [];
  for (const raw of tags) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const label = raw.trim();
    const slug = slugifyTag(label);
    if (slug && !map.has(slug)) {
      map.set(slug, label);
    }
  }

  // 2. Category tag
  if (server.category) {
    const cleanCat = parseCategoryLabel(server.category).label;
    const catSlug = slugifyTag(cleanCat);
    if (catSlug && !map.has(catSlug)) {
      map.set(catSlug, cleanCat);
    }
  }

  // 3. AI Use Cases tags
  const useCases = Array.isArray(server.aiUseCases) ? server.aiUseCases : [];
  for (const uc of useCases) {
    if (typeof uc !== 'string' || !uc.trim()) continue;
    const label = uc.trim();
    const slug = slugifyTag(label);
    if (slug && slug.length >= 3 && slug.length <= 30 && !map.has(slug)) {
      map.set(slug, label);
    }
  }

  // 4. Technology & Keyword extraction from Name / Description
  const textToScan = `${server.name || ''} ${server.description || ''} ${server.url || ''}`;
  for (const kw of TECH_KEYWORDS) {
    if (!map.has(kw.slug) && kw.pattern.test(textToScan)) {
      map.set(kw.slug, kw.label);
    }
  }

  return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
}

export type TagWithCount = {
  slug: string;
  label: string;
  count: number;
};

/**
 * One tag in the shared index: its display label, how many servable listings
 * carry it, and the ids of the most-engaged of them (engagementScore desc,
 * catalog order on ties), capped at what any consumer renders.
 */
type TagIndexEntry = { label: string; count: number; ids: string[] };
type TagIndex = Record<string, TagIndexEntry>;

/**
 * Most ids kept per tag: the rows /tags/[slug] lists (its JSON-LD list takes
 * the first 50; bigger tags link out to /browse search). `count` stays exact.
 */
const TAG_INDEX_IDS_CAP = 60;

/**
 * Tags are regex-extracted per listing, so there is no SQL that finds one
 * tag's listings: every tag page and the tag counts used to walk the whole
 * active catalog (~32k rows, ~17 D1 reads) on each regeneration. After a
 * deploy (new ISR build id) a crawl over the ~840 tag pages ran hundreds of
 * those walks and D1 was reset for exceeding its CPU limit. One walk now
 * builds this index, kept stale-while-revalidate per colo and in R2.
 */
const TAG_INDEX_CACHE_KEY = 'tag-index/v1';
const TAG_INDEX_CACHE = {
  freshMs: 60 * 60 * 1000,
  maxAgeSeconds: 24 * 60 * 60,
};

type TagAccumulator = {
  label: string;
  count: number;
  /** Best-first candidates; trimmed back to the cap as it grows. */
  top: { id: string; score: number }[];
};

const byScoreDesc = (a: { score: number }, b: { score: number }) =>
  b.score - a.score;

async function buildTagIndex(
  pages: AsyncIterable<Server[]>,
): Promise<TagIndex> {
  const acc = new Map<string, TagAccumulator>();

  // Paged: holding the whole catalog at once overran the Worker memory limit.
  for await (const page of pages) {
    for (const server of page) {
      const score = engagementScore(server);
      for (const { slug, label } of extractTagsForServer(server)) {
        let tag = acc.get(slug);
        if (!tag) {
          tag = { label, count: 0, top: [] };
          acc.set(slug, tag);
        }
        tag.count += 1;
        tag.top.push({ id: server.id, score });
        // Stable sort keeps catalog order on ties, as the full sort did.
        if (tag.top.length >= TAG_INDEX_IDS_CAP * 2) {
          tag.top.sort(byScoreDesc);
          tag.top.length = TAG_INDEX_IDS_CAP;
        }
      }
    }
  }

  const index: TagIndex = {};
  for (const [slug, tag] of acc) {
    index[slug] = {
      label: tag.label,
      count: tag.count,
      ids: tag.top
        .sort(byScoreDesc)
        .slice(0, TAG_INDEX_IDS_CAP)
        .map((t) => t.id),
    };
  }
  return index;
}

/**
 * The shared tag index. Built from D1 only: an empty walk (D1 missing or
 * failing) is never cached, and the page falls back to the static snapshot
 * catalog, uncached, as the per-request walk did.
 */
const getTagIndex = cache(async function getTagIndex(): Promise<TagIndex> {
  const cached = await swrEdgeCache(
    TAG_INDEX_CACHE_KEY,
    TAG_INDEX_CACHE,
    async () => {
      try {
        const index = await buildTagIndex(
          iterateActiveServersLight(undefined, { snapshotFallback: false }),
        );
        return Object.keys(index).length > 0 ? index : null;
      } catch (e) {
        // D1 failed mid-walk: a partial index would undercount every tag.
        console.error('[tags] tag index build failed:', e);
        return null;
      }
    },
  );
  return cached ?? buildTagIndex(iterateActiveServersLight());
});

function lookupTag(index: TagIndex, slug: string): TagIndexEntry | null {
  return Object.hasOwn(index, slug) ? index[slug] : null;
}

/**
 * Every tag with its count of servable listings, most-used first (label on
 * ties). Served from the shared tag index (/sitemap/core.xml and /tags).
 */
export async function getAllTagsWithCounts(): Promise<TagWithCount[]> {
  const index = await getTagIndex();
  return Object.entries(index)
    .map(([slug, { label, count }]) => ({ slug, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * One tag page's data: the top TAG_INDEX_IDS_CAP listings by engagement
 * (full rows, best first), the true number of listings carrying the tag, and
 * its label. An unknown tag has total 0. Wrapped in React `cache` because
 * /tags/[slug] calls it from both generateMetadata and the page.
 */
export const getServersForTag = cache(async function getServersForTag(
  targetSlug: string,
): Promise<{ servers: Server[]; total: number; rawTag: string }> {
  const tag = lookupTag(await getTagIndex(), targetSlug);
  if (!tag || tag.count === 0) {
    return { servers: [], total: 0, rawTag: targetSlug };
  }
  const servers = await hydrateServersByIds(tag.ids);
  return { servers, total: tag.count, rawTag: tag.label };
});
