import { describe, expect, it } from 'vitest';
import { editDistance, findTyposquatTarget } from './typosquat';

const POPULAR = [
  { name: '@modelcontextprotocol/server-github', downloads: 200_000 },
  { name: '@modelcontextprotocol/server-filesystem', downloads: 300_000 },
  { name: 'mcp-server-fetch', downloads: 50_000 },
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

  it('catches the same bare name under another scope', () => {
    expect(findTyposquatTarget('@stranger/server-filesystem', 5, POPULAR)).toBe(
      '@modelcontextprotocol/server-filesystem',
    );
  });

  it('catches a one-letter swap', () => {
    expect(findTyposquatTarget('mcp-server-fecth', 3, POPULAR)).toBe(
      'mcp-server-fetch',
    );
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

  it('ignores near names that are themselves well used', () => {
    expect(findTyposquatTarget('mcp-server-fecth', 10_000, POPULAR)).toBeNull();
  });
});
