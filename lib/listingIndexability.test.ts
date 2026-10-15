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

  it('needs traction AND proof it runs, not either alone', () => {
    expect(isListingIndexable(base)).toBe(false);
    expect(isListingIndexable({ ...base, githubStars: 25 })).toBe(false);
    expect(isListingIndexable({ ...base, npmDownloads: 100 })).toBe(false);
    expect(isListingIndexable({ ...base, toolsSource: 'introspected' })).toBe(
      false,
    );
    expect(
      isListingIndexable({
        ...base,
        githubStars: 25,
        toolsSource: 'introspected',
      }),
    ).toBe(true);
    expect(
      isListingIndexable({
        ...base,
        npmDownloads: 100,
        installNeedsConfig: new Date(),
      }),
    ).toBe(true);
    expect(
      isListingIndexable({
        ...base,
        githubStars: 25,
        remoteEndpointHealthy: 1,
      }),
    ).toBe(true);
  });

  it('indexes clearly popular servers without a verified run', () => {
    expect(isListingIndexable({ ...base, githubStars: 249 })).toBe(false);
    expect(isListingIndexable({ ...base, githubStars: 250 })).toBe(true);
    expect(isListingIndexable({ ...base, npmDownloads: 5000 })).toBe(true);
  });

  it('counts proof the server runs, not a README tool list', () => {
    expect(
      isListingIndexable({ ...base, githubStars: 25, toolsSource: 'readme' }),
    ).toBe(false);
  });

  it('never indexes non-active listings', () => {
    expect(
      isListingIndexable({
        ...base,
        githubStars: 5000,
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
