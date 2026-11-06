/**
 * Crawlable pagination for /categories/[slug] and /tags/[slug].
 *
 * Page 1 of a hub renders its top listings; before Nov 2026 the overflow was
 * only reachable through a `rel="nofollow"` link to /browse (noindex, later
 * pages loaded by JS), so most long-tail listings had no crawl path besides
 * the sitemap. Pages 2..N are plain, self-canonical HTML pages linked with
 * real <a href>s.
 *
 * The URL space is bounded on purpose: past page 1 a category only lists
 * listings we index ourselves (linking noindexed stubs spends crawl budget on
 * pages that can't rank), and both hub kinds stop at a fixed page count.
 */

/** Listings per hub page (page 1 included). */
export const HUB_PAGE_SIZE = 60;
/** Most pages a category hub gets, page 1 included. */
export const CATEGORY_MAX_PAGES = 10;
/** Most pages a tag hub gets, page 1 included (the tag index keeps this many ids). */
export const TAG_MAX_PAGES = 5;

/**
 * The page number in a `/page/[n]` segment. Only canonical spellings of 2 or
 * more count: page 1 lives at the bare hub URL, and "02", "2.0" or "+2" would
 * otherwise open duplicate URLs for the same page.
 */
export function parseHubPageParam(raw: string): number | null {
  if (!/^[1-9]\d{0,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 2 ? n : null;
}

/** Path of one page of a hub: page 1 is the bare hub URL. */
export function hubPagePath(base: string, page: number): string {
  return page <= 1 ? base : `${base}/page/${page}`;
}

/** Total pages for a hub with `total` listings, capped at `maxPages`. */
export function hubPageCount(total: number, maxPages: number): number {
  if (total <= 0) return 1;
  return Math.min(maxPages, Math.ceil(total / HUB_PAGE_SIZE));
}

/** The slice of an ordered id list that page `page` (1-based) renders. */
export function hubPageSlice<T>(items: T[], page: number): T[] {
  const start = (page - 1) * HUB_PAGE_SIZE;
  return items.slice(start, start + HUB_PAGE_SIZE);
}

type Rankable = {
  id: string;
  categorySponsorUntil?: Date | string | number | null;
};

/**
 * A category's listings in hub order: score descending, with an active
 * category sponsor (category_sponsor_7d) hard-pinned to #1. Shared by page 1
 * and the paginated pages so both agree on what page 1 holds.
 */
export function orderCategoryListings<T extends Rankable>(
  listings: T[],
  score: (s: T) => number,
  now: number,
): T[] {
  const byScore = [...listings].sort((a, b) => score(b) - score(a));
  const sponsorIdx = byScore.findIndex(
    (s) =>
      s.categorySponsorUntil &&
      new Date(s.categorySponsorUntil).getTime() > now,
  );
  if (sponsorIdx < 0) return byScore;
  return [
    byScore[sponsorIdx],
    ...byScore.slice(0, sponsorIdx),
    ...byScore.slice(sponsorIdx + 1),
  ];
}

export type CategoryPagination = {
  /** Ids page 1 shows, in order. */
  firstPageIds: string[];
  /** Indexable listings after page 1, in hub order, capped at the page limit. */
  laterIds: string[];
};

/**
 * Split an ordered category into page 1 (whatever ranks top, as before) and
 * the later pages, which keep only indexable listings.
 */
export function buildCategoryPagination(
  orderedIds: string[],
  indexableIds: Iterable<string>,
): CategoryPagination {
  const indexable = new Set(indexableIds);
  const firstPageIds = orderedIds.slice(0, HUB_PAGE_SIZE);
  const laterIds = orderedIds
    .slice(HUB_PAGE_SIZE)
    .filter((id) => indexable.has(id))
    .slice(0, (CATEGORY_MAX_PAGES - 1) * HUB_PAGE_SIZE);
  return { firstPageIds, laterIds };
}

/** Pages a category hub has: page 1 plus enough pages for `laterIds`. */
export function categoryPageCount(p: CategoryPagination): number {
  return 1 + Math.ceil(p.laterIds.length / HUB_PAGE_SIZE);
}

/** The ids category page `page` (2 or more) lists; empty past the last page. */
export function categoryLaterPageIds(
  p: CategoryPagination,
  page: number,
): string[] {
  return hubPageSlice(p.laterIds, page - 1);
}
