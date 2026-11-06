import { DIRECTORY_CATEGORIES } from './categories';
import { type HubCounts, isCategoryHubIndexable } from './hubIndexability';

/**
 * The category hubs the homepage links directly: the indexable hubs with the
 * most indexable listings. The homepage used to reach hubs only through the
 * footer, so every category sat a click deeper than it needed to. Without
 * counts (D1 down, or the build), the manifest order stands in.
 */
export function topCategoriesForHome(
  counts: HubCounts | null,
  limit: number,
): string[] {
  if (!counts) return DIRECTORY_CATEGORIES.slice(0, limit);
  return DIRECTORY_CATEGORIES.filter((c) => isCategoryHubIndexable(c, counts))
    .sort((a, b) => (counts.categories[b] ?? 0) - (counts.categories[a] ?? 0))
    .slice(0, limit);
}
