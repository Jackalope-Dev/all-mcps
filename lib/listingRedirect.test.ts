import { describe, expect, it } from 'vitest';
import {
  compareRedirectPath,
  listingRedirectPath,
  listingRedirectTarget,
  type MergeTargetRow,
  resolveCanonicalMergeTarget,
} from './listingRedirect';

describe('listingRedirectTarget', () => {
  it('returns the stored canonical id', () => {
    expect(listingRedirectTarget('old', { id: 'old', redirectTo: 'new' })).toBe(
      'new',
    );
  });

  it('ignores self-pointers and blanks', () => {
    expect(
      listingRedirectTarget('old', { id: 'old', redirectTo: 'old' }),
    ).toBeNull();
    expect(
      listingRedirectTarget('old', { id: 'old', redirectTo: '  ' }),
    ).toBeNull();
    expect(listingRedirectTarget('old', undefined)).toBeNull();
  });
});

describe('listingRedirectPath', () => {
  const moved = { id: 'mediar-ai-screenpipe', redirectTo: 'screenpipe' };

  it('308s the listing page', () => {
    expect(listingRedirectPath('mediar-ai-screenpipe', moved)).toBe(
      '/mcp/screenpipe',
    );
  });

  it('preserves nested paths so subroutes do not need next.config', () => {
    expect(listingRedirectPath('mediar-ai-screenpipe', moved, '/claim')).toBe(
      '/mcp/screenpipe/claim',
    );
    expect(
      listingRedirectPath('mediar-ai-screenpipe', moved, '/vs/other'),
    ).toBe('/mcp/screenpipe/vs/other');
  });
});

describe('compareRedirectPath', () => {
  it('rewrites whichever side has moved', () => {
    expect(
      compareRedirectPath(
        'old-a',
        'b',
        { id: 'old-a', redirectTo: 'a' },
        { id: 'b' },
      ),
    ).toBe('/mcp/a/vs/b');
  });

  it('returns null when both sides already canonical', () => {
    expect(compareRedirectPath('a', 'b', { id: 'a' }, { id: 'b' })).toBeNull();
  });
});

describe('resolveCanonicalMergeTarget', () => {
  const rows = new Map<string, MergeTargetRow>([
    ['canon', { id: 'canon', status: 'active', redirectTo: null }],
    ['mid', { id: 'mid', status: 'removed', redirectTo: 'canon' }],
    ['dead', { id: 'dead', status: 'removed', redirectTo: null }],
    ['loop-a', { id: 'loop-a', status: 'removed', redirectTo: 'loop-b' }],
    ['loop-b', { id: 'loop-b', status: 'removed', redirectTo: 'loop-a' }],
  ]);
  const lookup = async (id: string) => rows.get(id);

  it('requires an active terminal target', async () => {
    expect(await resolveCanonicalMergeTarget('dup', 'dead', lookup)).toEqual({
      error: 'Target listing "dead" is not active.',
    });
  });

  it('collapses a chain to the canonical id', async () => {
    expect(await resolveCanonicalMergeTarget('dup', 'mid', lookup)).toEqual({
      canonicalId: 'canon',
    });
  });

  it('rejects cycles', async () => {
    expect(await resolveCanonicalMergeTarget('dup', 'loop-a', lookup)).toEqual({
      error: 'Merge would create a redirect cycle.',
    });
  });

  it('rejects merging a listing into itself', async () => {
    expect(await resolveCanonicalMergeTarget('canon', 'canon', lookup)).toEqual(
      { error: 'Cannot merge a listing into itself.' },
    );
  });
});
