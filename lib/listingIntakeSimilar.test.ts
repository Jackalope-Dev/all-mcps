import { beforeEach, describe, expect, it, vi } from 'vitest';

const { candidates, alignListings } = vi.hoisted(() => ({
  candidates: vi.fn(),
  alignListings: vi.fn(),
}));

vi.mock('./urlDedup', async (orig) => ({
  ...(await orig<typeof import('./urlDedup')>()),
  findNearDuplicateCandidates: candidates,
}));
vi.mock('./listingReview', async (orig) => ({
  ...(await orig<typeof import('./listingReview')>()),
  alignListings,
}));

import { findSimilarListing, publicSimilarListing } from './listingIntake';

const db = {} as never;
const submitted = {
  url: 'https://www.producthunt.com/mcp/install',
  name: 'Product Hunt',
  description: 'Official Product Hunt MCP server.',
  websiteUrl: 'https://www.producthunt.com/mcp/install',
};
const wrapper = {
  id: 'jaipandya-producthunt-mcp-server',
  name: 'jaipandya/producthunt-mcp-server',
  status: 'active',
  url: 'https://github.com/jaipandya/producthunt-mcp-server',
  description: 'MCP server for Product Hunt.',
  websiteUrl: 'https://www.producthunt.com/v2/docs',
};

describe('findSimilarListing', () => {
  beforeEach(() => {
    candidates.mockReset();
    alignListings.mockReset();
  });

  it('returns the candidate Jev is unsure about instead of refusing it', async () => {
    candidates.mockResolvedValue([wrapper]);
    alignListings.mockResolvedValue('needs_review');
    await expect(findSimilarListing(db, submitted)).resolves.toEqual(wrapper);
  });

  it('skips candidates Jev says are different', async () => {
    candidates.mockResolvedValue([wrapper]);
    alignListings.mockResolvedValue('different');
    await expect(findSimilarListing(db, submitted)).resolves.toBeNull();
  });

  it('with Jev down, matches only on the same name and website', async () => {
    alignListings.mockResolvedValue(null);
    candidates.mockResolvedValue([wrapper]);
    await expect(findSimilarListing(db, submitted)).resolves.toBeNull();

    const sameNameSite = {
      ...wrapper,
      name: 'Product Hunt',
      websiteUrl: submitted.websiteUrl,
    };
    candidates.mockResolvedValue([sameNameSite]);
    await expect(findSimilarListing(db, submitted)).resolves.toEqual(
      sameNameSite,
    );
  });
});

describe('publicSimilarListing', () => {
  it('shows submitters only a live listing they could claim', () => {
    expect(publicSimilarListing(wrapper)).toEqual({
      id: wrapper.id,
      name: wrapper.name,
    });
    expect(publicSimilarListing({ ...wrapper, status: 'pending' })).toBeNull();
    expect(
      publicSimilarListing({ ...wrapper, status: 'withdrawn' }),
    ).toBeNull();
    expect(publicSimilarListing(null)).toBeNull();
  });
});
