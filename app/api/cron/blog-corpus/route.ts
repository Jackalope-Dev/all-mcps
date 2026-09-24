import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { type CorpusDoc, upsertCorpusDocs } from '@/lib/blogPipeline/corpus';
import { isCronAuthorized } from '@/lib/cronAuth';

/**
 * Receives existing articles into the blog pipeline's content_index so new
 * drafts cross-link to them and never duplicate or cannibalize them.
 *
 * Published posts, guides, /best and /clients hubs are synced automatically on
 * every pipeline run — use this for everything else: pages outside the code
 * registry, guest posts, docs on other properties, or a keyword you want to
 * reserve before the page exists.
 *
 *   POST { "articles": [{ "url": "/some-path", "title": "...",
 *          "primaryKeyword": "...", "excerpt": "...", "kind": "external" }] }
 *
 * `url` is a site-relative path for allmcps.com pages (so it is also a valid
 * internal link target) or an absolute URL for other sites (dedupe-only).
 */
const MAX_ARTICLES = 100;

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { env } = await getCloudflareContext();
    if (!env?.DB) throw new Error('Database binding not found');

    const body = (await req.json().catch(() => null)) as {
      articles?: unknown;
    } | null;
    if (!body || !Array.isArray(body.articles)) {
      return NextResponse.json(
        { error: 'Expected { articles: [...] }' },
        { status: 400 },
      );
    }

    const docs: CorpusDoc[] = [];
    const rejected: { index: number; reason: string }[] = [];
    body.articles.slice(0, MAX_ARTICLES).forEach((a: any, index: number) => {
      const url = typeof a?.url === 'string' ? a.url.trim() : '';
      const title = typeof a?.title === 'string' ? a.title.trim() : '';
      if (!/^(\/[^\s]*|https:\/\/[^\s]+)$/.test(url) || !title) {
        rejected.push({
          index,
          reason: 'url (path or https URL) and title required',
        });
        return;
      }
      // Code-owned kinds are managed by the automatic sync; don't let a caller spoof them.
      const kind =
        typeof a.kind === 'string' &&
        /^[a-z-]{3,20}$/.test(a.kind) &&
        !['blog', 'guide', 'best', 'client', 'tool', 'draft'].includes(a.kind)
          ? a.kind
          : 'external';
      docs.push({
        url: url.replace(/\/+$/, '') || '/',
        kind,
        title: title.slice(0, 300),
        primaryKeyword:
          typeof a.primaryKeyword === 'string' ? a.primaryKeyword : null,
        excerpt: typeof a.excerpt === 'string' ? a.excerpt : null,
      });
    });

    const db = drizzle(env.DB);
    const embedded = await upsertCorpusDocs(db, env.AI, docs);
    return NextResponse.json({
      ok: true,
      received: docs.length,
      embedded,
      rejected,
    });
  } catch (error) {
    console.error('[blog-corpus] failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed' },
      { status: 500 },
    );
  }
}
