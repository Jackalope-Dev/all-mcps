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
      isListingIndexable({ ...base, hasAiDoc: false, githubStars: 20000 }),
    ).toBe(false);
  });

  it('needs traction AND proof it runs, not either alone', () => {
    expect(isListingIndexable(base)).toBe(false);
    expect(isListingIndexable({ ...base, githubStars: 100 })).toBe(false);
    expect(isListingIndexable({ ...base, npmDownloads: 1000 })).toBe(false);
    expect(isListingIndexable({ ...base, toolsSource: 'introspected' })).toBe(
      false,
    );
    expect(
      isListingIndexable({
        ...base,
        githubStars: 100,
        toolsSource: 'introspected',
      }),
    ).toBe(true);
    expect(
      isListingIndexable({
        ...base,
        npmDownloads: 1000,
        installNeedsConfig: new Date(),
      }),
    ).toBe(true);
    expect(
      isListingIndexable({
        ...base,
        githubStars: 100,
        remoteEndpointHealthy: 1,
      }),
    ).toBe(true);
  });

  it('indexes clearly popular servers without a verified run', () => {
    expect(isListingIndexable({ ...base, githubStars: 999 })).toBe(false);
    expect(isListingIndexable({ ...base, githubStars: 1000 })).toBe(true);
    expect(isListingIndexable({ ...base, npmDownloads: 20000 })).toBe(true);
  });

  it('counts proof the server runs, not a README tool list', () => {
    expect(
      isListingIndexable({ ...base, githubStars: 100, toolsSource: 'readme' }),
    ).toBe(false);
  });

  it('never indexes non-active listings', () => {
    expect(
      isListingIndexable({
        ...base,
        githubStars: 20000,
        status: 'pending',
      }),
    ).toBe(false);
  });

  it('noindexes listings the stale sweep has flagged', () => {
    expect(
      isListingIndexable({ ...base, githubStars: 20000, staleFlagged: true }),
    ).toBe(false);
  });
});
