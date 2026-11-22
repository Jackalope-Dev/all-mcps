import { renderToStaticMarkup, renderToString } from 'react-dom/server';
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

describe('SafeMarkdown links to our own pages', () => {
  const blog = (content: string) =>
    renderToStaticMarkup(<SafeMarkdown content={content} ownContent />);

  it('renders absolute allmcps.com links as plain internal links', () => {
    const out = blog('Read [the guide](https://allmcps.com/mcp-security).');
    expect(out).toContain('<a href="/mcp-security">the guide</a>');
  });

  it('keeps root-relative links internal in our own writing', () => {
    const out = blog('See [Postgres](/mcp/crystaldba-postgres-mcp).');
    expect(out).toContain('<a href="/mcp/crystaldba-postgres-mcp">');
    expect(out).not.toContain('utm_');
    expect(out).not.toContain('nofollow');
  });
});

// Search Console listed hundreds of 404s on allmcps.com made by our own
// listing pages: relative README links resolving against /mcp/<id>, and
// example paths (`/path/to/venv/bin/python3`, `/etc`) reaching the page as
// standalone "/..." strings.
describe('SafeMarkdown never points listing content at allmcps.com', () => {
  const monorepo = 'https://github.com/awslabs/mcp/tree/main/src/aws-docs';
  const render = (content: string, repoUrl?: string) =>
    renderToStaticMarkup(<SafeMarkdown content={content} repoUrl={repoUrl} />);
  const hrefs = (out: string) =>
    [...out.matchAll(/\b(?:href|src)="([^"]*)"/g)].map((m) => m[1]);

  it('resolves relative links and images from the README folder', () => {
    const out = render(
      [
        '[quick start](docs/getting-started/quick-start.md)',
        '[root](/docs/GETTING_STARTED.md)',
        '[sibling](../aws-serverless-mcp-server)',
        '<a href="plugins/aimarket-reputation/">plugin</a>',
        '![arch](assets/arch.png)',
        '[install](#install)',
      ].join('\n\n'),
      monorepo,
    );
    const links = hrefs(out);
    expect(links).toContain('#install');
    for (const href of links.filter((h) => h !== '#install')) {
      expect(href).toMatch(
        /^https:\/\/(github\.com|raw\.githubusercontent\.com)\/awslabs\/mcp\//,
      );
    }
    expect(out).toContain(
      'blob/HEAD/src/aws-docs/docs/getting-started/quick-start.md',
    );
    expect(out).toContain('blob/HEAD/docs/GETTING_STARTED.md');
    expect(out).toContain('blob/HEAD/src/aws-serverless-mcp-server');
    expect(out).toContain('awslabs/mcp/HEAD/src/aws-docs/assets/arch.png');
  });

  it('renders links it cannot resolve as plain text', () => {
    for (const repo of ['https://gitlab.com/acme/mcp', undefined]) {
      const out = render(
        '[guide](docs/GETTING_STARTED.md) [root](/docs/x.md) <a href="packages/openclaw">pkg</a> ![x](a.png)',
        repo,
      );
      expect(hrefs(out)).toEqual([]);
      expect(out).toContain('guide');
      expect(out).toContain('pkg');
    }
    const escaped = render(
      '[up](../../../x.md)',
      'https://github.com/acme/mcp',
    );
    expect(hrefs(escaped)).toEqual([]);
  });

  it('splits standalone paths so no text child starts with a slash', () => {
    const out = renderToString(
      <SafeMarkdown
        content={
          'Use `/path/to/venv/bin/python3`.\n\n| a |\n| - |\n| /opt |\n\n/srv'
        }
        repoUrl="https://github.com/acme/mcp"
      />,
    );
    expect(out).toContain('/<!-- -->path/to/venv/bin/python3');
    expect(out).toContain('/<!-- -->opt');
    expect(out).toContain('/<!-- -->srv');
  });
});
