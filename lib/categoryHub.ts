import {
  buildCategoryPagination,
  type CategoryPagination,
  orderCategoryListings,
} from './categoryPagination';
import { swrEdgeCache } from './edgeCache';
import {
  getIndexableIdsInCategory,
  getRankingCandidates,
  relatedRankingScore,
} from './servers';

/**
 * Hourly, like the category page's own ISR window, so page 1 and the later
 * pages split the ranking at the same place. Building one entry scans the
 * category's slim ranking rows once (the same read page 1 already does), so
 * the later pages only hydrate the 60 rows they show instead of re-ranking.
 */
const CATEGORY_PAGINATION_CACHE = {
  freshMs: 60 * 60 * 1000,
  maxAgeSeconds: 2 * 24 * 60 * 60,
};

/**
 * The ordered page split for one category hub, or null when D1 can't say
 * which listings are indexable (build time, or a failed read). Null means
 * "no later pages": page 1 renders without pagination and /page/N 404s.
 */
export async function getCategoryPagination(
  category: string,
): Promise<CategoryPagination | null> {
  return swrEdgeCache<CategoryPagination>(
    `category-pagination/v1/${category}`,
    CATEGORY_PAGINATION_CACHE,
    async () => {
      const [candidates, indexableIds] = await Promise.all([
        getRankingCandidates({ category }),
        getIndexableIdsInCategory(category),
      ]);
      if (!indexableIds) return null;
      const ordered = orderCategoryListings(
        candidates,
        relatedRankingScore,
        Date.now(),
      );
      return buildCategoryPagination(
        ordered.map((s) => s.id),
        indexableIds,
      );
    },
  );
}
