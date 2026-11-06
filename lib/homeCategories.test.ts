import { describe, expect, it } from 'vitest';
import { DIRECTORY_CATEGORIES } from './categories';
import { topCategoriesForHome } from './homeCategories';
import { MIN_INDEXABLE_LISTINGS_PER_HUB } from './hubIndexability';

describe('topCategoriesForHome', () => {
  it('falls back to manifest order without counts', () => {
    expect(topCategoriesForHome(null, 3)).toEqual(
      DIRECTORY_CATEGORIES.slice(0, 3),
    );
  });

  it('picks the biggest indexable hubs and skips thin ones', () => {
    const [a, b, c, d] = DIRECTORY_CATEGORIES;
    const counts = {
      categories: {
        [a]: 10,
        [b]: 500,
        [c]: MIN_INDEXABLE_LISTINGS_PER_HUB - 1,
        [d]: 40,
      },
      topics: {},
    };
    expect(topCategoriesForHome(counts, 12)).toEqual([b, d, a]);
    expect(topCategoriesForHome(counts, 2)).toEqual([b, d]);
  });
});
