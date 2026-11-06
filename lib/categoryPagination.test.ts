import { describe, expect, it } from 'vitest';
import {
  buildCategoryPagination,
  CATEGORY_MAX_PAGES,
  categoryLaterPageIds,
  categoryPageCount,
  HUB_PAGE_SIZE,
  hubPageCount,
  hubPagePath,
  hubPageSlice,
  orderCategoryListings,
  parseHubPageParam,
  TAG_MAX_PAGES,
} from './categoryPagination';

const ids = (n: number, prefix = 's') =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('parseHubPageParam', () => {
  it('accepts canonical page numbers from 2', () => {
    expect(parseHubPageParam('2')).toBe(2);
    expect(parseHubPageParam('10')).toBe(10);
  });

  it('rejects page 1 and non-canonical spellings, so no duplicate URLs open', () => {
    for (const raw of ['1', '0', '02', '2.0', '+2', '-2', 'abc', '', '99999']) {
      expect(parseHubPageParam(raw)).toBeNull();
    }
  });
});

describe('hubPagePath', () => {
  it('puts page 1 at the bare hub URL', () => {
    expect(hubPagePath('/categories/databases', 1)).toBe(
      '/categories/databases',
    );
    expect(hubPagePath('/tags/python', 3)).toBe('/tags/python/page/3');
  });
});

describe('hubPageCount / hubPageSlice', () => {
  it('counts pages and caps them', () => {
    expect(hubPageCount(0, TAG_MAX_PAGES)).toBe(1);
    expect(hubPageCount(60, TAG_MAX_PAGES)).toBe(1);
    expect(hubPageCount(61, TAG_MAX_PAGES)).toBe(2);
    expect(hubPageCount(10_000, TAG_MAX_PAGES)).toBe(TAG_MAX_PAGES);
  });

  it('slices one page at a time', () => {
    const all = ids(130);
    expect(hubPageSlice(all, 1)).toEqual(all.slice(0, 60));
    expect(hubPageSlice(all, 3)).toEqual(all.slice(120));
    expect(hubPageSlice(all, 4)).toEqual([]);
  });
});

describe('orderCategoryListings', () => {
  const score = (s: { id: string; v: number }) => s.v;

  it('sorts by score, best first', () => {
    const out = orderCategoryListings(
      [
        { id: 'a', v: 1 },
        { id: 'b', v: 3 },
        { id: 'c', v: 2 },
      ],
      score,
      0,
    );
    expect(out.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('pins an active category sponsor to #1 and ignores an expired one', () => {
    const now = Date.parse('2026-11-06T00:00:00Z');
    const listings = [
      { id: 'top', v: 9 },
      {
        id: 'expired',
        v: 8,
        categorySponsorUntil: '2026-11-01T00:00:00Z',
      },
      {
        id: 'sponsor',
        v: 1,
        categorySponsorUntil: '2026-11-10T00:00:00Z',
      },
    ];
    expect(
      orderCategoryListings(listings, score, now).map((s) => s.id),
    ).toEqual(['sponsor', 'top', 'expired']);
  });
});

describe('buildCategoryPagination', () => {
  it('keeps page 1 as ranked and only indexable listings after it', () => {
    const ordered = ids(200);
    // Every even listing is indexable.
    const indexable = ordered.filter((_, i) => i % 2 === 0);
    const p = buildCategoryPagination(ordered, indexable);
    expect(p.firstPageIds).toEqual(ordered.slice(0, HUB_PAGE_SIZE));
    expect(p.laterIds).toEqual(
      ordered.slice(HUB_PAGE_SIZE).filter((_, i) => i % 2 === 0),
    );
    expect(p.laterIds).toHaveLength(70);
    expect(categoryPageCount(p)).toBe(3);
    expect(categoryLaterPageIds(p, 2)).toEqual(p.laterIds.slice(0, 60));
    expect(categoryLaterPageIds(p, 3)).toEqual(p.laterIds.slice(60));
    expect(categoryLaterPageIds(p, 4)).toEqual([]);
  });

  it('has a single page when nothing indexable is left after page 1', () => {
    const p = buildCategoryPagination(ids(100), ids(60));
    expect(p.laterIds).toEqual([]);
    expect(categoryPageCount(p)).toBe(1);
  });

  it('caps a huge category at CATEGORY_MAX_PAGES pages', () => {
    const ordered = ids(20_000);
    const p = buildCategoryPagination(ordered, ordered);
    expect(categoryPageCount(p)).toBe(CATEGORY_MAX_PAGES);
    expect(p.laterIds).toHaveLength((CATEGORY_MAX_PAGES - 1) * HUB_PAGE_SIZE);
  });
});
