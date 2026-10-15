import { and, eq, isNull, like, or, type SQL, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { unstable_cache } from 'next/cache';
import { servers } from '../db/schema';
import { BEST_TOPICS, type BestTopic } from './bestTopics';
import { categoryFromSlug } from './categories';
import { indexableListingSql } from './listingIndexability';

/**
 * Category hubs and /best topics are indexable only when they rank enough
 * listings that are themselves indexable (lib/listingIndexability.ts). In Oct
 * 2026, 19 of 56 category hubs had 0-4 such listings: a templated page ranking
 * listings we noindex ourselves, the scaled-catalog shape the Sept 2026 spam
 * update demoted. Those hubs stay browsable as noindex,follow and leave the
 * sitemap, and return on their own once enough listings qualify.
 */
export const MIN_INDEXABLE_LISTINGS_PER_HUB = 5;

export type HubCounts = {
  /** Indexable listings per raw category value. */
  categories: Record<string, number>;
  /** Indexable listings per /best topic slug. */
  topics: Record<string, number>;
};

function topicCondition(topic: BestTopic): SQL | undefined {
  const category = topic.categorySlug
    ? categoryFromSlug(topic.categorySlug)
    : undefined;
  const keywords = (topic.match ?? []).filter(Boolean);
  // Same coarse filter as getRankingCandidates (category + LIKE keywords).
  const conditions: (SQL | undefined)[] = [];
  if (category) conditions.push(eq(servers.category, category));
  if (keywords.length > 0) {
    conditions.push(
      or(
        ...keywords.flatMap((k) => [
          like(servers.name, `%${k}%`),
          like(servers.description, `%${k}%`),
        ]),
      ),
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

async function fetchHubCounts(): Promise<HubCounts | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    if (!ctx?.env || !(ctx.env as any).DB) return null;
    const db = drizzle((ctx.env as any).DB);
    const servable = and(
      eq(servers.status, 'active'),
      isNull(servers.staleFlaggedAt),
    );
    const indexable = indexableListingSql();

    const categoryRows = await db
      .select({
        category: servers.category,
        n: sql<number>`count(*)`,
      })
      .from(servers)
      .where(and(servable, indexable))
      .groupBy(servers.category);

    const topics: Record<string, number> = {};
    const keywordTopics = BEST_TOPICS.filter((t) => t.match?.length);
    if (keywordTopics.length > 0) {
      const columns: Record<string, SQL<number>> = {};
      keywordTopics.forEach((t, i) => {
        const cond = topicCondition(t);
        if (cond) {
          columns[`t${i}`] =
            sql<number>`sum(CASE WHEN ${cond} THEN 1 ELSE 0 END)`;
        }
      });
      const [row] = await db
        .select(columns)
        .from(servers)
        .where(and(servable, indexable));
      keywordTopics.forEach((t, i) => {
        topics[t.slug] = Number(row?.[`t${i}`] ?? 0);
      });
    }

    const categories: Record<string, number> = {};
    for (const r of categoryRows) {
      categories[r.category ?? ''] = Number(r.n ?? 0);
    }
    return { categories, topics };
  } catch (e: any) {
    const msg = e?.message || e?.cause?.message || String(e);
    if (msg.includes('no such table') || msg.includes('D1_ERROR')) {
      console.warn(
        '[hubIndexability] D1 not available, leaving hubs indexable.',
      );
    } else {
      console.error('[hubIndexability] D1 read failed:', e);
    }
    return null;
  }
}

const getCachedHubCounts = unstable_cache(fetchHubCounts, ['hub-counts'], {
  revalidate: 3600,
});

/** Null when D1 is unavailable; callers then leave hubs indexable. */
export async function getHubCounts(): Promise<HubCounts | null> {
  try {
    return (await getCachedHubCounts()) ?? (await fetchHubCounts());
  } catch {
    return fetchHubCounts();
  }
}

export function isCategoryHubIndexable(
  category: string,
  counts: HubCounts | null,
): boolean {
  if (!counts) return true;
  return (counts.categories[category] ?? 0) >= MIN_INDEXABLE_LISTINGS_PER_HUB;
}

export function isBestTopicIndexable(
  topic: BestTopic,
  counts: HubCounts | null,
): boolean {
  if (!counts) return true;
  if (topic.match?.length) {
    return (counts.topics[topic.slug] ?? 0) >= MIN_INDEXABLE_LISTINGS_PER_HUB;
  }
  const category = topic.categorySlug
    ? categoryFromSlug(topic.categorySlug)
    : undefined;
  return category ? isCategoryHubIndexable(category, counts) : true;
}
