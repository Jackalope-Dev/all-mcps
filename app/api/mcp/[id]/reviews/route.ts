import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { reviews, servers } from '../../../../../db/schema';
import { auth } from '../../../../../lib/auth';
import { verifyTurnstileToken } from '../../../../../lib/turnstile';
import { getServerReviews } from '../../../../../lib/servers';

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().or(z.literal('')),
  'cf-turnstile-response': z.string().optional(),
});

/** Public aggregate + approved comments — no auth needed, safe to call server-side from the ISR'd /mcp/[id] page. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const summary = await getServerReviews(id);
  return NextResponse.json(summary);
}

/**
 * Login-gated review submission. The star rating publishes immediately
 * (counted in the aggregate right away); a written comment is held behind
 * `commentStatus` until an admin approves it — see db/schema.ts's `reviews`
 * table comment and the approve_review_comment/reject_review_comment
 * actions in app/api/admin/action/route.ts.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      /* fallback to process.env inside verifyTurnstileToken */
    }

    const body = (await req.json()) as any;

    const turnstileResult = await verifyTurnstileToken(
      body['cf-turnstile-response'],
      env,
      req.headers.get('x-forwarded-for') || ''
    );
    if (!turnstileResult.ok) {
      return NextResponse.json({ error: turnstileResult.error }, { status: turnstileResult.status });
    }

    const result = reviewSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }
    const { rating } = result.data;
    const newComment = result.data.comment ? result.data.comment.trim() : '';

    if (!env?.DB) {
      return NextResponse.json({ error: 'Database binding not found' }, { status: 500 });
    }
    const db = drizzle(env.DB as any);

    const [server] = await db.select({ id: servers.id }).from(servers).where(eq(servers.id, id)).limit(1);
    if (!server) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const [existing] = await db
      .select({ comment: reviews.comment, commentStatus: reviews.commentStatus })
      .from(reviews)
      .where(and(eq(reviews.serverId, id), eq(reviews.userId, userId)))
      .limit(1);

    let commentStatus: 'none' | 'pending' | 'approved' | 'rejected';
    if (!newComment) {
      commentStatus = 'none';
    } else if (existing && existing.comment === newComment && existing.commentStatus !== 'none') {
      // Unchanged comment text on a rating-only edit — don't re-queue a
      // comment that's already approved (or already pending/rejected).
      commentStatus = existing.commentStatus as 'pending' | 'approved' | 'rejected';
    } else {
      commentStatus = 'pending';
    }

    await db
      .insert(reviews)
      .values({ serverId: id, userId, rating, comment: newComment || null, commentStatus })
      .onConflictDoUpdate({
        target: [reviews.serverId, reviews.userId],
        set: { rating, comment: newComment || null, commentStatus, updatedAt: new Date() },
      });

    return NextResponse.json({ success: true, commentStatus });
  } catch (error) {
    console.error('Review submission error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
