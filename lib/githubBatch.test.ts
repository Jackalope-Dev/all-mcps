import { describe, expect, it } from 'vitest';
import {
  batchableRepoSlug,
  buildRepoBatchQuery,
  parseRepoBatchResponse,
} from './githubBatch';

describe('batchableRepoSlug', () => {
  it('accepts plain GitHub repos and rejects anything else', () => {
    expect(batchableRepoSlug('https://github.com/Acme/mcp.git')).toBe(
      'acme/mcp',
    );
    expect(batchableRepoSlug('https://example.com/acme/mcp')).toBeNull();
  });
});

describe('buildRepoBatchQuery', () => {
  it('aliases each repo in order', () => {
    const q = buildRepoBatchQuery(['a/b', 'c/d']);
    expect(q).toContain('r0: repository(owner: "a", name: "b")');
    expect(q).toContain('r1: repository(owner: "c", name: "d")');
    expect(q).toContain('HEAD:README.md');
  });
});

describe('parseRepoBatchResponse', () => {
  it('maps repos, missing repos and errors back in order', () => {
    const out = parseRepoBatchResponse(['a/b', 'gone/x', 'c/d', 'e/f'], {
      data: {
        r0: {
          stargazerCount: 42,
          pushedAt: '2026-10-01T00:00:00Z',
          isArchived: false,
          isDisabled: false,
          isFork: true,
          parent: { nameWithOwner: 'up/stream' },
          latestRelease: { tagName: 'v1.2.0' },
          rm0: null,
          rm1: { oid: 'abc123' },
        },
        r1: null,
        r2: null,
        r3: { stargazerCount: 1, isArchived: true },
      },
      errors: [
        { type: 'NOT_FOUND', path: ['r1'] },
        { type: 'RATE_LIMITED', path: ['r2'] },
      ],
    });
    expect(out[0]).toEqual({
      kind: 'ok',
      stars: 42,
      pushedAt: new Date('2026-10-01T00:00:00Z'),
      archived: false,
      forkOf: 'up/stream',
      latestReleaseTag: 'v1.2.0',
      readmeOid: 'abc123',
      readmePath: 'readme.md',
    });
    expect(out[1]).toEqual({ kind: 'missing' });
    expect(out[2]).toEqual({ kind: 'error' });
    expect(out[3]).toMatchObject({
      kind: 'ok',
      archived: true,
      readmeOid: null,
    });
  });

  it('treats a failed request as errors, not missing repos', () => {
    expect(
      parseRepoBatchResponse(['a/b'], { message: 'Bad credentials' }),
    ).toEqual([{ kind: 'error' }]);
  });
});
