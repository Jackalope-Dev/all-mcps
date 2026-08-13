import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { sponsorAds, sponsorAdLogs } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashVisitorForServer, getClientIp } from '@/lib/upvoteHash';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    let body: any = null;
    const text = await request.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        // fail gracefully
      }
    }

    if (!body || !body.adId || !body.eventType) {
      return NextResponse.json({ error: 'Missing adId or eventType' }, { status: 400 });
    }

    const { adId, placement = 'all', eventType } = body;
    if (eventType !== 'impression' && eventType !== 'click') {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
    }

    const ctx = await getCloudflareContext();
    if (!ctx?.env?.DB) {
      return NextResponse.json({ ok: true });
    }

    const db = drizzle(ctx.env.DB);
    const ip = getClientIp(request);
    const sessionHash = ip ? await hashVisitorForServer(ip, adId) : null;

    // Log the event
    await db.insert(sponsorAdLogs).values({
      adId,
      eventType,
      placement,
      sessionHash,
      createdAt: new Date(),
    });

    // Update aggregate counters on sponsorAds
    if (eventType === 'impression') {
      await db
        .update(sponsorAds)
        .set({
          impressionsServed: sql`${sponsorAds.impressionsServed} + 1`,
        })
        .where(eq(sponsorAds.id, adId));

      // Check if campaign completed
      const [current] = await db
        .select({
          served: sponsorAds.impressionsServed,
          total: sponsorAds.totalImpressionsPurchased,
        })
        .from(sponsorAds)
        .where(eq(sponsorAds.id, adId));

      if (current && current.served >= current.total) {
        await db
          .update(sponsorAds)
          .set({
            status: 'completed',
            completedAt: new Date(),
          })
          .where(eq(sponsorAds.id, adId));
      }
    } else if (eventType === 'click') {
      await db
        .update(sponsorAds)
        .set({
          clicksCount: sql`${sponsorAds.clicksCount} + 1`,
        })
        .where(eq(sponsorAds.id, adId));
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[ads/event] error:', err?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
