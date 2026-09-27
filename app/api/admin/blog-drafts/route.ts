import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { blogDrafts } from '@/db/schema';
import { getAuthorizedAdminEmail } from '@/lib/adminAuth';
import blogManifest from '@/lib/blog-manifest.json';
import { listDrafts, setDraftStatus } from '@/lib/blogPipeline/pipeline';
import {
  blogPostPath,
  commitNewFile,
  draftToMarkdown,
  getBlogPublishConfig,
} from '@/lib/blogPipeline/publish';

/**
 * Admin review queue for the blog pipeline (lib/blogPipeline).
 *
 *   GET                                  → ready + needs_human drafts, in-flight counts
 *   POST { id, action: 'publish' }       → commit content/blog/<today>-<slug>.md to
 *                                          main (deploys via Workers Builds), mark exported
 *   POST { id, action: 'reject' }        → discard
 *   POST { id, action: 'retry' }         → send a needs_human draft back through review
 */

const parse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

async function getEnv() {
  const { env } = await getCloudflareContext();
  if (!env?.DB) throw new Error('Database binding not found');
  return env;
}

export async function GET() {
  if (!(await getAuthorizedAdminEmail())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const env = await getEnv();
    const db = drizzle(env.DB);
    const rows = await listDrafts(db, ['ready', 'needs_human']);
    const inFlight = await listDrafts(db, ['review', 'revise']);
    return NextResponse.json({
      publishConfigured: getBlogPublishConfig(env) !== null,
      inFlight: inFlight.length,
      drafts: rows.map((r) => ({
        id: r.id,
        status: r.status,
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        primaryKeyword: r.primaryKeyword,
        tags: parse<string[]>(r.tags, []),
        faq: parse<{ q: string; a: string }[]>(r.faq, []),
        content: r.content,
        iterations: r.iterations,
        review: parse<Record<string, any> | null>(r.review, null),
        backlinkSuggestions: parse<
          { url: string; title: string; anchor: string }[]
        >(r.backlinkSuggestions, []),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('[admin/blog-drafts] list failed', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load drafts' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!(await getAuthorizedAdminEmail())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    id?: unknown;
    action?: unknown;
  } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  const action = body?.action;
  if (
    !id ||
    (action !== 'publish' && action !== 'reject' && action !== 'retry')
  ) {
    return NextResponse.json(
      { error: 'Expected { id, action: publish|reject|retry }' },
      { status: 400 },
    );
  }

  try {
    const env = await getEnv();
    const db = drizzle(env.DB);

    if (action === 'reject' || action === 'retry') {
      const ok = await setDraftStatus(
        db,
        id,
        action === 'reject' ? 'rejected' : 'review',
      );
      return ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const config = getBlogPublishConfig(env);
    if (!config) {
      return NextResponse.json(
        {
          error:
            'Publishing is not configured. Add a BLOG_PUBLISH_TOKEN Worker secret (fine-grained GitHub PAT with Contents: read & write on the repo).',
        },
        { status: 503 },
      );
    }

    const [row] = await db
      .select()
      .from(blogDrafts)
      .where(eq(blogDrafts.id, id))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    if (row.status !== 'ready' && row.status !== 'needs_human') {
      return NextResponse.json(
        { error: `Draft is '${row.status}', not publishable` },
        { status: 409 },
      );
    }
    if (blogManifest.some((p) => p.slug === row.slug)) {
      return NextResponse.json(
        { error: `A live post already uses the slug "${row.slug}"` },
        { status: 409 },
      );
    }

    // UTC date, matching what the build compares against to hide future posts.
    const date = new Date().toISOString().slice(0, 10);
    const path = blogPostPath(date, row.slug);
    const markdown = draftToMarkdown({
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      tags: parse<string[]>(row.tags, []),
      faq: parse<{ q: string; a: string }[]>(row.faq, []),
      content: row.content,
    });

    // The repo is public — keep the commit message free of admin identity.
    const result = await commitNewFile(
      config,
      path,
      markdown,
      `Publish blog post: ${row.title}\n\nApproved in the admin dashboard.`,
    );
    if (!result.ok) {
      console.error('[admin/blog-drafts] publish failed', result.error);
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    await setDraftStatus(db, id, 'exported');
    return NextResponse.json({
      ok: true,
      path,
      url: `/blog/${row.slug}`,
      commitUrl: result.commitUrl,
      alreadyExisted: result.alreadyExisted,
    });
  } catch (error: any) {
    console.error('[admin/blog-drafts] action failed', error);
    return NextResponse.json(
      { error: error?.message || 'Action failed' },
      { status: 500 },
    );
  }
}
