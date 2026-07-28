import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers, upvoteRecords } from '../../../../../db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { z } from 'zod';
import { getClientIp, hashUpvoteVoter } from '../../../../../lib/upvoteHash';

const metricSchema = z.object({
  metric: z.enum(["view", "copy", "upvote"])
});

async function getDb() {
  const ctx = await getCloudflareContext();
  const env = ctx.env;
  if (!env || !(env as any).DB) {
    return null;
  }
  return drizzle((env as any).DB as any);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = metricSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }

    const { metric } = result.data;

    let db;
    try {
      db = await getDb();
    } catch (e) {
      return NextResponse.json({ error: "Could not get Cloudflare context." }, { status: 500 });
    }
    if (!db) {
      return NextResponse.json({ error: "Database binding not found" }, { status: 500 });
    }

    if (metric === "upvote") {
      const ip = getClientIp(req);
      const ipHash = await hashUpvoteVoter(ip, id);
      if (!ipHash) {
        return NextResponse.json({ error: "Upvote is not configured" }, { status: 500 });
      }

      const inserted = await db.insert(upvoteRecords)
        .values({ serverId: id, ipHash })
        .onConflictDoNothing({ target: [upvoteRecords.serverId, upvoteRecords.ipHash] })
        .returning({ serverId: upvoteRecords.serverId });

      if (inserted.length === 0) {
        return NextResponse.json({ success: false, alreadyVoted: true }, { status: 409 });
      }

      await db.update(servers)
        .set({ upvotes: sql`${servers.upvotes} + 1` })
        .where(eq(servers.id, id));

      return NextResponse.json({ success: true });
    }

    const updateQuery = metric === "view"
      ? { views: sql`${servers.views} + 1` }
      : { copies: sql`${servers.copies} + 1` };

    await db.update(servers).set(updateQuery).where(eq(servers.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Metric update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    let db;
    try {
      db = await getDb();
    } catch (e) {
      return NextResponse.json({ error: "Could not get Cloudflare context." }, { status: 500 });
    }
    if (!db) {
      return NextResponse.json({ error: "Database binding not found" }, { status: 500 });
    }

    const ip = getClientIp(req);
    const ipHash = await hashUpvoteVoter(ip, id);
    if (!ipHash) {
      return NextResponse.json({ alreadyVoted: false });
    }

    const existing = await db.select({ serverId: upvoteRecords.serverId })
      .from(upvoteRecords)
      .where(and(eq(upvoteRecords.serverId, id), eq(upvoteRecords.ipHash, ipHash)))
      .limit(1);

    return NextResponse.json({ alreadyVoted: existing.length > 0 });
  } catch (error) {
    console.error("Metric status error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
