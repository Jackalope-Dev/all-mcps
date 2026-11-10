import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SafeMarkdown } from './SafeMarkdownImpl';

const html = (content: string) =>
  renderToStaticMarkup(
    <SafeMarkdown content={content} repoUrl="https://github.com/acme/mcp" />,
  );

describe('SafeMarkdown links', () => {
  it('marks README / description links ugc nofollow', () => {
    const out = html('See [the docs](https://acme.dev/docs).');
    expect(out).toContain('rel="ugc nofollow noopener noreferrer"');
  });

  it("doesn't let raw HTML in the README override the rel", () => {
    const out = html('<a href="https://acme.dev" rel="noopener">site</a>');
    expect(out).toContain('rel="ugc nofollow noopener noreferrer"');
    expect(out).not.toContain('rel="noopener"');
  });
});
