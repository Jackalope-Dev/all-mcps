import { describe, expect, it } from 'vitest';
import { editDistance, findTyposquatTarget } from './typosquat';

const POPULAR = [
  { name: '@modelcontextprotocol/server-github', downloads: 200_000 },
  { name: '@notionhq/notion-mcp-server', downloads: 300_000 },
  { name: 'mcp-server-fetch', downloads: 50_000 },
  { name: 'mcp-server-mysql', downloads: 40_000 },
  { name: 'tiny', downloads: 90_000 },
];

describe('editDistance', () => {
  it('counts adjacent swaps as one edit', () => {
    expect(editDistance('github', 'githbu')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
  });
});

describe('findTyposquatTarget', () => {
  it('catches a look-alike scope', () => {
    expect(
      findTyposquatTarget('@modeicontextprotocol/server-github', 0, POPULAR),
    ).toBe('@modelcontextprotocol/server-github');
  });

  it('catches swapped letters and homoglyphs', () => {
    expect(findTyposquatTarget('mcp-server-fecth', 3, POPULAR)).toBe(
      'mcp-server-fetch',
    );
    expect(findTyposquatTarget('rncp-server-mysql', 0, POPULAR)).toBe(
      'mcp-server-mysql',
    );
  });

  it('leaves descriptive names shared by other authors alone', () => {
    expect(findTyposquatTarget('notion-mcp-server', 5, POPULAR)).toBeNull();
    expect(
      findTyposquatTarget('@acme/notion-mcp-server', 5, POPULAR),
    ).toBeNull();
  });

  it('does not treat a different real product one letter away as a copy', () => {
    expect(findTyposquatTarget('mcp-server-mssql', 0, POPULAR)).toBeNull();
  });

  it('leaves the real package, numbered siblings and short names alone', () => {
    expect(
      findTyposquatTarget(
        '@modelcontextprotocol/server-github',
        200_000,
        POPULAR,
      ),
    ).toBeNull();
    expect(findTyposquatTarget('mcp-server-fetch2', 10, POPULAR)).toBeNull();
    expect(findTyposquatTarget('tinx', 0, POPULAR)).toBeNull();
  });

  it('gives no verdict without a download count, or for well-used names', () => {
    expect(findTyposquatTarget('mcp-server-fecth', null, POPULAR)).toBeNull();
    expect(findTyposquatTarget('mcp-server-fecth', 10_000, POPULAR)).toBeNull();
  });
});
