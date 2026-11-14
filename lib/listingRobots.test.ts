import { describe, expect, it } from 'vitest';
import { listingRobotsMeta } from './listingIndexability';

/** The /mcp/[id] robots meta and canonical (generateMetadata reads this). */
describe('listingRobotsMeta', () => {
  const kept = {
    id: 'popular',
    name: 'Popular',
    status: 'active',
    aiDoc: 'Our writeup.',
    githubStars: 5000,
  };

  it('leaves an indexable listing indexable with a self canonical', () => {
    expect(listingRobotsMeta(kept)).toEqual({
      robots: null,
      canonicalUrl: 'https://allmcps.com/mcp/popular',
    });
  });

  it('serves noindex, follow on a thin listing and keeps it self-canonical', () => {
    expect(
      listingRobotsMeta({ ...kept, id: 'thin', githubStars: 3, aiDoc: null }),
    ).toEqual({
      robots: { index: false, follow: true },
      canonicalUrl: 'https://allmcps.com/mcp/thin',
    });
  });

  it('points a duplicate at the kept listing with noindex, follow', () => {
    expect(
      listingRobotsMeta({ ...kept, id: 'supabase-community-supabase-mcp' }),
    ).toEqual({
      robots: { index: false, follow: true },
      canonicalUrl: 'https://allmcps.com/mcp/supabase',
    });
  });

  it('serves noindex, nofollow on a removed listing', () => {
    expect(listingRobotsMeta({ ...kept, status: 'removed' }).robots).toEqual({
      index: false,
      follow: false,
    });
  });
});
