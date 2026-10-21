import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { servers, upvoteRecords, viewRecords } from '../../../../../db/schema';
import { classifyCaller } from '../../../../../lib/accessLog';
import {
  getClientIp,
  hashVisitorForServer,
} from '../../../../../lib/upvoteHash';
import { formatZodError } from '../../../../../lib/zodError';

/** How long before the same visitor's next view counts toward ranking again. */
const VIEW_RECOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

const metricSchema = z.object({
  metric: z.enum(['view', 'copy', 'upvote', 'unupvote']),
});

async function getDb() {
  const ctx = await getCloudflareContext();
  const env = ctx.env;
  if (!env || !(env as any).DB) {
    return null;
  }
  return drizzle((env as any).DB as any);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = metricSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: formatZodError(result.error) },
        { status: 400 },
      );
    }

    const { metric } = result.data;

    const caller = classifyCaller(req.headers.get('user-agent'));
    const isBot = caller !== 'browser' && caller !== 'unknown';
    if (isBot && (metric === 'view' || metric === 'copy')) {
      return NextResponse.json({ success: true, skipped: 'bot' });
    }

    let db: Awaited<ReturnType<typeof getDb>>;
    try {
      db = await getDb();
    } catch {
      return NextResponse.json(
        { error: 'Could not get Cloudflare context.' },
        { status: 500 },
      );
    }
    if (!db) {
      return NextResponse.json(
        { error: 'Database binding not found' },
        { status: 500 },
      );
    }

    // --- Upvote: one per (server, hashed IP) ---
    if (metric === 'upvote') {
      const ip = getClientIp(req);
      const ipHash = await hashVisitorForServer(ip, id);
      if (!ipHash) {
        return NextResponse.json(
          { error: 'Upvote is not configured' },
          { status: 500 },
        );
      }

      const inserted = await db
        .insert(upvoteRecords)
        .values({ serverId: id, ipHash })
        .onConflictDoNothing({
          target: [upvoteRecords.serverId, upvoteRecords.ipHash],
        })
        .returning({ serverId: upvoteRecords.serverId });

      if (inserted.length === 0) {
        return NextResponse.json(
          { success: false, alreadyVoted: true },
          { status: 409 },
        );
      }

      await db
        .update(servers)
        .set({ upvotes: sql`${servers.upvotes} + 1` })
        .where(eq(servers.id, id));

      return NextResponse.json({ success: true });
    }

    // --- Unupvote: remove vote for (server, hashed IP) ---
    if (metric === 'unupvote') {
      const ip = getClientIp(req);
      const ipHash = await hashVisitorForServer(ip, id);
      if (!ipHash) {
        return NextResponse.json(
          { error: 'Upvote is not configured' },
          { status: 500 },
        );
      }

      const deleted = await db
        .delete(upvoteRecords)
        .where(
          and(eq(upvoteRecords.serverId, id), eq(upvoteRecords.ipHash, ipHash)),
        )
        .returning({ serverId: upvoteRecords.serverId });

      if (deleted.length === 0) {
        return NextResponse.json(
          { success: false, notVoted: true },
          { status: 404 },
        );
      }

      await db
        .update(servers)
        .set({
          upvotes: sql`CASE WHEN ${servers.upvotes} > 0 THEN ${servers.upvotes} - 1 ELSE 0 END`,
        })
        .where(eq(servers.id, id));

      return NextResponse.json({ success: true });
    }

    // --- View: every load bumps the public totalViews; the ranking `views`
    // count bumps at most once per (server, hashed IP) per VIEW_RECOUNT_WINDOW_MS,
    // so return visits count as interest but a refresh loop does not.
    if (metric === 'view') {
      const ip = getClientIp(req);
      const ipHash = await hashVisitorForServer(ip, id);
      if (!ipHash) {
        return NextResponse.json(
          { error: 'View tracking is not configured' },
          { status: 500 },
        );
      }

      const now = new Date();
      const cutoff = new Date(now.getTime() - VIEW_RECOUNT_WINDOW_MS);
      // Upsert whose update only applies once the window has passed; a row
      // comes back only when this visit should count.
      const counted = await db
        .insert(viewRecords)
        .values({ serverId: id, ipHash, createdAt: now, lastCountedAt: now })
        .onConflictDoUpdate({
          target: [viewRecords.serverId, viewRecords.ipHash],
          set: { lastCountedAt: now },
          setWhere: or(
            isNull(viewRecords.lastCountedAt),
            lt(viewRecords.lastCountedAt, cutoff),
          ),
        })
        .returning({ serverId: viewRecords.serverId });

      await db
        .update(servers)
        .set({
          totalViews: sql`${servers.totalViews} + 1`,
          ...(counted.length > 0 ? { views: sql`${servers.views} + 1` } : {}),
        })
        .where(eq(servers.id, id));

      return NextResponse.json({ success: true, counted: counted.length > 0 });
    }

    // --- Copy: still a raw counter (install intent can fire more than once) ---
    await db
      .update(servers)
      .set({ copies: sql`${servers.copies} + 1` })
      .where(eq(servers.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Metric update error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const caller = classifyCaller(req.headers.get('user-agent'));
    if (caller !== 'browser' && caller !== 'unknown') {
      return NextResponse.json({ alreadyVoted: false, alreadyViewed: false });
    }

    const { id } = await params;

    let db: Awaited<ReturnType<typeof getDb>>;
    try {
      db = await getDb();
    } catch {
      return NextResponse.json(
        { error: 'Could not get Cloudflare context.' },
        { status: 500 },
      );
    }
    if (!db) {
      return NextResponse.json(
        { error: 'Database binding not found' },
        { status: 500 },
      );
    }

    const ip = getClientIp(req);
    const ipHash = await hashVisitorForServer(ip, id);
    if (!ipHash) {
      return NextResponse.json({ alreadyVoted: false, alreadyViewed: false });
    }

    const [existingUpvote, existingView] = await Promise.all([
      db
        .select({ serverId: upvoteRecords.serverId })
        .from(upvoteRecords)
        .where(
          and(eq(upvoteRecords.serverId, id), eq(upvoteRecords.ipHash, ipHash)),
        )
        .limit(1),
      db
        .select({ serverId: viewRecords.serverId })
        .from(viewRecords)
        .where(
          and(eq(viewRecords.serverId, id), eq(viewRecords.ipHash, ipHash)),
        )
        .limit(1),
    ]);

    return NextResponse.json({
      alreadyVoted: existingUpvote.length > 0,
      alreadyViewed: existingView.length > 0,
    });
  } catch (error) {
    console.error('Metric status error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
