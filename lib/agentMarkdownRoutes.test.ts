import { describe, expect, it } from 'vitest';
import { hasAgentMarkdown, normalizeAgentPath } from './agentMarkdownRoutes';

describe('hasAgentMarkdown', () => {
  it('accepts pages that have a Markdown rendering', () => {
    for (const p of [
      '/',
      '/blog',
      '/blog/some-post',
      '/categories/databases',
      '/best',
      '/best/postgres/',
      '/clients/cursor',
      '/prompts/x',
      '/mcp/a/vs/b',
      '/mcp/a/alternatives',
    ]) {
      expect(hasAgentMarkdown(p), p).toBe(true);
    }
  });

  it('rejects pages without one, so they serve HTML instead of a stub', () => {
    for (const p of [
      '/trust',
      '/state-of-mcp',
      '/what-is-mcp',
      '/tools/token-calculator',
      '/best/postgres/extra',
      '/mcp/a/vs',
    ]) {
      expect(hasAgentMarkdown(p), p).toBe(false);
    }
  });
});

describe('normalizeAgentPath', () => {
  it('strips trailing slashes but keeps the root', () => {
    expect(normalizeAgentPath('/best///')).toBe('/best');
    expect(normalizeAgentPath('///')).toBe('/');
    expect(normalizeAgentPath('/')).toBe('/');
  });
});
