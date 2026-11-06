import { describe, expect, it } from 'vitest';
import { relatedHubsForPost } from './blogHubLinks';

const post = (over: Partial<Parameters<typeof relatedHubsForPost>[0]>) => ({
  title: '',
  tags: [],
  keywords: [],
  content: '',
  ...over,
});

describe('relatedHubsForPost', () => {
  it('links the /best and category hubs a post is about', () => {
    const links = relatedHubsForPost(
      post({
        title: 'Browser automation with Playwright and Puppeteer',
        tags: ['Using MCP', 'browser automation'],
        content: 'Browser automation servers drive a real browser.',
      }),
    );
    const hrefs = links.map((l) => l.href);
    expect(hrefs[0]).toBe('/best/browser-automation');
    expect(hrefs).toContain('/categories/browser-automation');
  });

  it('matches integration hubs by their keywords', () => {
    const hrefs = relatedHubsForPost(
      post({
        title: 'Connecting an agent to PostgreSQL',
        content: 'Point the server at postgres with a read-only role.',
      }),
    ).map((l) => l.href);
    expect(hrefs).toContain('/best/postgres');
  });

  it('ignores a single passing body mention', () => {
    const hrefs = relatedHubsForPost(
      post({
        title: 'MCP transports explained',
        content: 'You could even run it next to a gitlab runner.',
      }),
    ).map((l) => l.href);
    expect(hrefs).not.toContain('/best/gitlab');
  });

  it('falls back to the directory indexes so every post links it', () => {
    expect(
      relatedHubsForPost(post({ title: 'Protocol version notes' })),
    ).toEqual([
      { href: '/best', label: 'Best MCP servers by topic' },
      { href: '/categories', label: 'Browse MCP servers by category' },
    ]);
  });

  it('caps the number of links and never repeats one', () => {
    const links = relatedHubsForPost(
      post({
        title: 'Security for GitHub, GitLab, Docker, Kubernetes and AWS',
        content: 'security github gitlab docker kubernetes aws postgres mysql',
      }),
      4,
    );
    expect(links).toHaveLength(4);
    expect(new Set(links.map((l) => l.href)).size).toBe(4);
  });
});
