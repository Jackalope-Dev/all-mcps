import { describe, expect, it } from 'vitest';
import { resolveUrl } from './resolveMarkdownUrl';

const repo = 'https://github.com/arcmira/mcp';

describe('resolveUrl', () => {
  it('resolves relative links against the default branch, not main', () => {
    expect(resolveUrl('./plugins/arcmira#keep-it-updated', repo)).toBe(
      'https://github.com/arcmira/mcp/blob/HEAD/plugins/arcmira#keep-it-updated',
    );
  });

  it('resolves relative images to raw content on the default branch', () => {
    expect(resolveUrl('assets/logo.png', `${repo}.git`, true)).toBe(
      'https://raw.githubusercontent.com/arcmira/mcp/HEAD/assets/logo.png',
    );
  });

  it('leaves absolute and anchor links alone', () => {
    expect(resolveUrl('https://example.com/x', repo)).toBe(
      'https://example.com/x',
    );
    expect(resolveUrl('#install', repo)).toBe('#install');
  });
});
