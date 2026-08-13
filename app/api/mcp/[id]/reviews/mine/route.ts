import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { reviews } from '../../../../../../db/schema';
import { auth } from '../../../../../../lib/auth';

/**
 * Client-side "do I already have a review here" check for the review
 * composer on /mcp/[id] — same split-into-its-own-route pattern as
 * app/api/mcp/[id]/is-owner, since the detail page itself can never call
 * auth() without forcing the page dynamic (killing its ISR cache).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ signedIn: false, review: null });
  }

  try {
    const ctx = await getCloudflareContext();
    const env = ctx.env as any;
    if (!env?.DB) return NextResponse.json({ signedIn: true, review: null });
    const db = drizzle(env.DB);
    const [row] = await db
      .select({ rating: reviews.rating, comment: reviews.comment, commentStatus: reviews.commentStatus })
      .from(reviews)
      .where(and(eq(reviews.serverId, id), eq(reviews.userId, userId)))
      .limit(1);
    return NextResponse.json({ signedIn: true, review: row || null });
  } catch {
    return NextResponse.json({ signedIn: true, review: null });
  }
}
