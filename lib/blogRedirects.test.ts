import { describe, expect, it } from 'vitest';
import { getPostBySlug } from './blog';
import { BLOG_REDIRECTS } from './blogRedirects';

const slugOf = (path: string) => path.replace(/^\/blog\//, '').split('#')[0];

describe('BLOG_REDIRECTS', () => {
  it('only redirects posts that no longer exist', () => {
    for (const source of Object.keys(BLOG_REDIRECTS)) {
      expect(getPostBySlug(slugOf(source))).toBeUndefined();
    }
  });

  it('points blog targets at live posts, never at another redirect', () => {
    for (const target of Object.values(BLOG_REDIRECTS)) {
      expect(BLOG_REDIRECTS[target.split('#')[0]]).toBeUndefined();
      if (target.startsWith('/blog/')) {
        expect(getPostBySlug(slugOf(target))).toBeDefined();
      }
    }
  });
});
