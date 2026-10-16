import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  batchableRepoSlug,
  buildRepoBatchQuery,
  fetchRepoSnapshots,
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

describe('fetchRepoSnapshots', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Answers every repo as ok, but 502s any query asking for more than `max`. */
  function stubGraphql(max: number) {
    const sizes: number[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const query = JSON.parse(init.body).query as string;
        const n = (query.match(/: repository\(/g) ?? []).length;
        sizes.push(n);
        if (n > max) return new Response('', { status: 502 });
        const data = Object.fromEntries(
          Array.from({ length: n }, (_, i) => [`r${i}`, { stargazerCount: 1 }]),
        );
        return new Response(JSON.stringify({ data }), { status: 200 });
      }),
    );
    return sizes;
  }

  const slugs = Array.from({ length: 45 }, (_, i) => `o/r${i}`);

  it('asks GitHub in chunks small enough to finish', async () => {
    const sizes = stubGraphql(20);
    const out = await fetchRepoSnapshots(slugs, 't');
    expect(sizes).toEqual([20, 20, 5]);
    expect([...out.values()].every((s) => s.kind === 'ok')).toBe(true);
  });

  it('splits a chunk that times out instead of writing it all off', async () => {
    const sizes = stubGraphql(10);
    const out = await fetchRepoSnapshots(slugs.slice(0, 20), 't');
    expect(sizes).toEqual([20, 10, 10]);
    expect([...out.values()].every((s) => s.kind === 'ok')).toBe(true);
  });

  it('gives up on a chunk at the smallest split size', async () => {
    stubGraphql(0);
    const out = await fetchRepoSnapshots(slugs.slice(0, 5), 't');
    expect([...out.values()]).toEqual(
      Array.from({ length: 5 }, () => ({ kind: 'error' })),
    );
  });
});
