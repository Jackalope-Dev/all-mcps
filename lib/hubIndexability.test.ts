import { describe, expect, it } from 'vitest';
import { BEST_TOPICS } from './bestTopics';
import { categoryFromSlug } from './categories';
import {
  isBestTopicIndexable,
  isCategoryHubIndexable,
  MIN_INDEXABLE_LISTINGS_PER_HUB,
} from './hubIndexability';

const keywordTopic = BEST_TOPICS.find((t) => t.match?.length);
const categoryTopic = BEST_TOPICS.find(
  (t) => !t.match?.length && t.categorySlug,
);

describe('hub indexability', () => {
  it('stays indexable when counts are unavailable', () => {
    expect(isCategoryHubIndexable('🗄️ Databases', null)).toBe(true);
    if (keywordTopic)
      expect(isBestTopicIndexable(keywordTopic, null)).toBe(true);
  });

  it('needs enough indexable listings in the category', () => {
    const counts = {
      categories: {
        thin: MIN_INDEXABLE_LISTINGS_PER_HUB - 1,
        solid: MIN_INDEXABLE_LISTINGS_PER_HUB,
      },
      topics: {},
    };
    expect(isCategoryHubIndexable('thin', counts)).toBe(false);
    expect(isCategoryHubIndexable('solid', counts)).toBe(true);
    expect(isCategoryHubIndexable('missing', counts)).toBe(false);
  });

  it('judges keyword topics by their own count', () => {
    if (!keywordTopic) return;
    const thin = { categories: {}, topics: { [keywordTopic.slug]: 2 } };
    const solid = { categories: {}, topics: { [keywordTopic.slug]: 12 } };
    expect(isBestTopicIndexable(keywordTopic, thin)).toBe(false);
    expect(isBestTopicIndexable(keywordTopic, solid)).toBe(true);
  });

  it('judges category topics by their category hub', () => {
    if (!categoryTopic?.categorySlug) return;
    const category = categoryFromSlug(categoryTopic.categorySlug);
    if (!category) return;
    const counts = { categories: { [category]: 0 }, topics: {} };
    expect(isBestTopicIndexable(categoryTopic, counts)).toBe(false);
  });
});
