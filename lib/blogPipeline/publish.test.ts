import matter from 'gray-matter';
import { describe, expect, it, vi } from 'vitest';
import {
  blogPostPath,
  commitNewFile,
  DEFAULT_BLOG_REPO,
  draftToMarkdown,
  getBlogPublishConfig,
} from './publish';

const draft = {
  title: 'MCP "Quotes": Colons & Émoji 🚀',
  slug: 'mcp-quotes',
  excerpt: 'An excerpt: with a colon, a # hash and "quotes".',
  tags: ['MCP', 'Guides'],
  faq: [{ q: 'Does it: work?', a: 'Yes — even with "quotes".' }],
  content: '\n## Heading\n\nBody text.\n',
};

const config = { token: 't', repo: 'o/r', branch: 'main' };

describe('draftToMarkdown', () => {
  it('round-trips through gray-matter the way lib/blog.ts reads posts', () => {
    const { data, content } = matter(draftToMarkdown(draft));
    expect(data.title).toBe(draft.title);
    expect(data.excerpt).toBe(draft.excerpt);
    expect(data.tags).toEqual(draft.tags);
    expect(data.faq).toEqual(draft.faq);
    expect(content.trim()).toBe('## Heading\n\nBody text.');
  });

  it('omits the faq block when there are no questions', () => {
    const md = draftToMarkdown({ ...draft, faq: [] });
    expect(md).not.toContain('faq:');
    expect(matter(md).data.faq).toBeUndefined();
  });

  it('builds the dated filename lib/blog.ts expects', () => {
    expect(blogPostPath('2026-09-27', 'mcp-quotes')).toBe(
      'content/blog/2026-09-27-mcp-quotes.md',
    );
  });
});

describe('getBlogPublishConfig', () => {
  it('is null without a token and defaults repo/branch with one', () => {
    expect(getBlogPublishConfig({})).toBeNull();
    expect(getBlogPublishConfig({ BLOG_PUBLISH_TOKEN: ' abc ' })).toEqual({
      token: 'abc',
      repo: DEFAULT_BLOG_REPO,
      branch: 'main',
    });
  });
});

describe('commitNewFile', () => {
  it('creates the file with UTF-8 safe base64 content', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(
        Response.json(
          { commit: { html_url: 'https://github.com/o/r/commit/abc' } },
          { status: 201 },
        ),
      );
    const body = 'héllo 🚀';
    const res = await commitNewFile(
      config,
      'content/blog/x.md',
      body,
      'msg',
      fetchMock,
    );
    expect(res).toEqual({
      ok: true,
      alreadyExisted: false,
      commitUrl: 'https://github.com/o/r/commit/abc',
    });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(
      'https://api.github.com/repos/o/r/contents/content/blog/x.md',
    );
    expect(init.method).toBe('PUT');
    const sent = JSON.parse(init.body);
    expect(sent.branch).toBe('main');
    expect(Buffer.from(sent.content, 'base64').toString('utf8')).toBe(body);
  });

  it('never overwrites an existing file', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ sha: 'x' }, { status: 200 }));
    const res = await commitNewFile(config, 'p.md', 'c', 'm', fetchMock);
    expect(res).toEqual({ ok: true, alreadyExisted: true, commitUrl: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces GitHub errors instead of reporting success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('Bad credentials', { status: 401 }));
    const res = await commitNewFile(config, 'p.md', 'c', 'm', fetchMock);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(401);
      expect(res.error).toContain('Bad credentials');
    }
  });
});
