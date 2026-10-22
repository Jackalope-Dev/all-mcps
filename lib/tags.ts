import { cache } from 'react';
import { DIRECTORY_CATEGORIES, parseCategoryLabel } from './categories';
import { swrEdgeCache } from './edgeCache';
import { engagementScore } from './search';
import {
  hydrateServersByIds,
  iterateActiveServersLight,
  type LightServer,
  type Server,
} from './servers';
import { tagBySlug, vocabularyTags } from './tagVocabulary';

function slugifyTag(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A listing's tags: the vocabulary slugs in its stored `tags` column
 * (lib/tagVocabulary.ts, written by lib/tagClassifier.ts). Anything else in
 * the column — free-form model tags and submitter tags from before the fixed
 * vocabulary — is ignored. Tags used to also come from AI use cases, the
 * listing category and a loose keyword regex, which produced ~24k distinct
 * one-listing tags; see lib/tagVocabulary.ts.
 */
function extractTagsForServer(
  server: Server,
): { slug: string; label: string }[] {
  return vocabularyTags(server.tags).map((t) => ({
    slug: t.slug,
    label: t.label,
  }));
}

export type TagWithCount = {
  slug: string;
  label: string;
  count: number;
  /** Offered to search engines: robots meta on /tags/[slug] and the core sitemap. */
  indexable: boolean;
};

/**
 * One tag in the shared index: its display label, how many servable listings
 * carry it, how many of those are indexable listings (null when the index was
 * built from the snapshot, which has no verdict), and the ids of the
 * most-engaged of them (engagementScore desc, catalog order on ties), capped
 * at what any consumer renders.
 */
type TagIndexEntry = {
  label: string;
  count: number;
  indexable: number | null;
  ids: string[];
};
type TagIndex = {
  tags: Record<string, TagIndexEntry>;
  /** Indexable listings across the catalog; null for a snapshot build. */
  indexableListings: number | null;
};

/**
 * Tag pages are indexable only on listings we index ourselves
 * (lib/listingIndexability.ts), like category and /best hubs
 * (lib/hubIndexability.ts). Counting every servable listing let ~895 tag
 * pages into the sitemap (Oct 2026), most of them ranking listings we noindex,
 * and none earned a Search Console impression. Tags now come from a fixed
 * vocabulary and each one is confirmed per listing by Jev
 * (lib/tagClassifier.ts), so the bar sits a little above the hubs' 5.
 */
const MIN_INDEXABLE_LISTINGS_PER_TAG = 8;
/**
 * Near-universal tags say nothing about their listings. Runtime tags
 * (Python, Node.js…) are exempt: "Python MCP servers" is a real search even
 * when a large share of listings qualify.
 */
const MAX_TAG_SHARE_OF_INDEXABLE = 0.2;
/** Tags taken from a listing's category duplicate /categories/[slug]. */
const CATEGORY_TAG_SLUGS = new Set(
  DIRECTORY_CATEGORIES.map((c) => slugifyTag(parseCategoryLabel(c).label)),
);

function isTagIndexable(
  slug: string,
  tag: TagIndexEntry,
  indexableListings: number | null,
): boolean {
  if (CATEGORY_TAG_SLUGS.has(slug)) return false;
  // Snapshot build (D1 down): no listing verdicts, so the old size bar.
  if (tag.indexable === null || indexableListings === null) {
    return tag.count >= 10 && tag.count <= 200;
  }
  return (
    tag.indexable >= MIN_INDEXABLE_LISTINGS_PER_TAG &&
    (tagBySlug(slug)?.group === 'runtime' ||
      tag.indexable <= indexableListings * MAX_TAG_SHARE_OF_INDEXABLE)
  );
}

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
const TAG_INDEX_CACHE_KEY = 'tag-index/v3';
const TAG_INDEX_CACHE = {
  freshMs: 60 * 60 * 1000,
  maxAgeSeconds: 24 * 60 * 60,
};

type TagAccumulator = {
  label: string;
  count: number;
  indexable: number;
  /** Best-first candidates; trimmed back to the cap as it grows. */
  top: { id: string; score: number }[];
};

const byScoreDesc = (a: { score: number }, b: { score: number }) =>
  b.score - a.score;

async function buildTagIndex(
  pages: AsyncIterable<LightServer[]>,
): Promise<TagIndex> {
  const acc = new Map<string, TagAccumulator>();
  let indexableListings = 0;
  let hasVerdicts = false;

  // Paged: holding the whole catalog at once overran the Worker memory limit.
  for await (const page of pages) {
    for (const server of page) {
      const score = engagementScore(server);
      if (server.indexable !== undefined) hasVerdicts = true;
      if (server.indexable) indexableListings += 1;
      for (const { slug, label } of extractTagsForServer(server)) {
        let tag = acc.get(slug);
        if (!tag) {
          tag = { label, count: 0, indexable: 0, top: [] };
          acc.set(slug, tag);
        }
        tag.count += 1;
        if (server.indexable) tag.indexable += 1;
        tag.top.push({ id: server.id, score });
        // Stable sort keeps catalog order on ties, as the full sort did.
        if (tag.top.length >= TAG_INDEX_IDS_CAP * 2) {
          tag.top.sort(byScoreDesc);
          tag.top.length = TAG_INDEX_IDS_CAP;
        }
      }
    }
  }

  const tags: TagIndex['tags'] = {};
  for (const [slug, tag] of acc) {
    tags[slug] = {
      label: tag.label,
      count: tag.count,
      indexable: hasVerdicts ? tag.indexable : null,
      ids: tag.top
        .sort(byScoreDesc)
        .slice(0, TAG_INDEX_IDS_CAP)
        .map((t) => t.id),
    };
  }
  return { tags, indexableListings: hasVerdicts ? indexableListings : null };
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
        return Object.keys(index.tags).length > 0 ? index : null;
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
  return Object.hasOwn(index.tags, slug) ? index.tags[slug] : null;
}

/**
 * Every tag with its count of servable listings, most-used first (label on
 * ties). Served from the shared tag index (/sitemap/core.xml and /tags).
 */
export async function getAllTagsWithCounts(): Promise<TagWithCount[]> {
  const index = await getTagIndex();
  return Object.entries(index.tags)
    .map(([slug, tag]) => ({
      slug,
      label: tag.label,
      count: tag.count,
      indexable: isTagIndexable(slug, tag, index.indexableListings),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * One tag page's data: the top TAG_INDEX_IDS_CAP listings by engagement
 * (full rows, best first), the true number of listings carrying the tag, its
 * label, and whether search engines get it. An unknown tag has total 0. Wrapped in React `cache` because
 * /tags/[slug] calls it from both generateMetadata and the page.
 */
export const getServersForTag = cache(async function getServersForTag(
  targetSlug: string,
): Promise<{
  servers: Server[];
  total: number;
  rawTag: string;
  indexable: boolean;
}> {
  const index = await getTagIndex();
  const tag = lookupTag(index, targetSlug);
  if (!tag || tag.count === 0) {
    return { servers: [], total: 0, rawTag: targetSlug, indexable: false };
  }
  const servers = await hydrateServersByIds(tag.ids);
  return {
    servers,
    total: tag.count,
    rawTag: tag.label,
    indexable: isTagIndexable(targetSlug, tag, index.indexableListings),
  };
});
