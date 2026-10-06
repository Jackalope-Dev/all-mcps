import { describe, expect, it } from 'vitest';
import { isListingIndexable } from './listingIndexability';

const base = {
  hasAiDoc: true,
  hasTools: false,
  githubStars: 0,
  npmDownloads: 0,
};

describe('isListingIndexable', () => {
  it('requires our own writeup', () => {
    expect(
      isListingIndexable({ ...base, hasAiDoc: false, githubStars: 5000 }),
    ).toBe(false);
  });

  it('requires a second signal beyond the writeup', () => {
    expect(isListingIndexable(base)).toBe(false);
    expect(isListingIndexable({ ...base, hasTools: true })).toBe(true);
    expect(isListingIndexable({ ...base, githubStars: 25 })).toBe(true);
    expect(isListingIndexable({ ...base, npmDownloads: 100 })).toBe(true);
  });

  it('never indexes non-active listings', () => {
    expect(
      isListingIndexable({ ...base, hasTools: true, status: 'pending' }),
    ).toBe(false);
  });
});
