import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { listDrafts, setDraftStatus } from '@/lib/blogPipeline/pipeline';
import { isCronAuthorized } from '@/lib/cronAuth';

/**
 * Hand-off point between the blog pipeline and the repo, used by
 * scripts/pull-blog-drafts.mjs.
 *
 *   GET  ?status=ready[,needs_human]  → drafts with review notes
 *   POST { id, status: 'exported' | 'rejected' | 'review' }
 *        exported — the script wrote content/blog/<date>-<slug>.md
 *        rejected — discard (frees the topic's intent for another attempt)
 *        review   — send a needs_human draft back through the loop
 */
const ALLOWED_LIST = new Set([
  'ready',
  'needs_human',
  'review',
  'revise',
  'rejected',
  'exported',
]);

async function db() {
  const { env } = await getCloudflareContext();
  if (!env?.DB) throw new Error('Database binding not found');
  return drizzle(env.DB);
}

export async function GET(req: Request) {
  if (!(await isCronAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const statuses = (new URL(req.url).searchParams.get('status') || 'ready')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => ALLOWED_LIST.has(s));
  const rows = await listDrafts(
    await db(),
    statuses.length ? statuses : ['ready'],
  );
  return NextResponse.json({
    drafts: rows.map((r) => ({
      ...r,
      tags: JSON.parse(r.tags),
      faq: JSON.parse(r.faq),
      review: r.review ? JSON.parse(r.review) : null,
      backlinkSuggestions: r.backlinkSuggestions
        ? JSON.parse(r.backlinkSuggestions)
        : [],
    })),
  });
}

export async function POST(req: Request) {
  if (!(await isCronAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    id?: unknown;
    status?: unknown;
  } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  const status = body?.status;
  if (
    !id ||
    (status !== 'exported' && status !== 'rejected' && status !== 'review')
  ) {
    return NextResponse.json(
      { error: 'Expected { id, status: exported|rejected|review }' },
      { status: 400 },
    );
  }
  const ok = await setDraftStatus(await db(), id, status);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
