import { describe, expect, it } from 'vitest';
import { getAllPosts } from './blog';
import { isBlogTopic, MAX_POST_TOPICS } from './blogTopics';

describe('blog post tags', () => {
  it('uses 1-2 tags from BLOG_TOPICS on every post', () => {
    for (const post of getAllPosts()) {
      const offList = post.tags.filter((t) => !isBlogTopic(t));
      expect(offList, post.slug).toEqual([]);
      expect(post.tags.length, post.slug).toBeGreaterThanOrEqual(1);
      expect(post.tags.length, post.slug).toBeLessThanOrEqual(MAX_POST_TOPICS);
    }
  });
});
