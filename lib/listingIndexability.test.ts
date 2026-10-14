import { describe, expect, it } from 'vitest';
import { isListingIndexable } from './listingIndexability';

const base = {
  hasAiDoc: true,
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
    expect(isListingIndexable({ ...base, githubStars: 25 })).toBe(true);
    expect(isListingIndexable({ ...base, npmDownloads: 100 })).toBe(true);
  });

  it('counts proof the server runs, not a README tool list', () => {
    expect(isListingIndexable({ ...base, toolsSource: 'readme' })).toBe(false);
    expect(isListingIndexable({ ...base, toolsSource: 'introspected' })).toBe(
      true,
    );
    expect(
      isListingIndexable({ ...base, installNeedsConfig: new Date() }),
    ).toBe(true);
    expect(isListingIndexable({ ...base, remoteEndpointHealthy: 1 })).toBe(
      true,
    );
  });

  it('never indexes non-active listings', () => {
    expect(
      isListingIndexable({
        ...base,
        toolsSource: 'introspected',
        status: 'pending',
      }),
    ).toBe(false);
  });

  it('noindexes listings the stale sweep has flagged', () => {
    expect(
      isListingIndexable({ ...base, githubStars: 5000, staleFlagged: true }),
    ).toBe(false);
  });
});
