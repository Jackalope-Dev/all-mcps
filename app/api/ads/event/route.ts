import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { sponsorAds, sponsorAdLogs } from '@/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { hashVisitorForServer, getClientIp } from '@/lib/upvoteHash';
import { sendNotificationEmail } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// Repeated page loads / rage-clicks from the same visitor shouldn't burn through
// an advertiser's purchased credits or inflate CTR.
const IMPRESSION_DEDUP_WINDOW_MS = 10 * 60 * 1000;
const CLICK_DEDUP_WINDOW_MS = 30 * 1000;

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

    // Check for a recent duplicate from the same visitor before counting it.
    // Without an IP-derived hash we can't dedup reliably, so those always count.
    let isDuplicate = false;
    if (sessionHash) {
      const dedupWindowMs = eventType === 'impression' ? IMPRESSION_DEDUP_WINDOW_MS : CLICK_DEDUP_WINDOW_MS;
      const since = new Date(Date.now() - dedupWindowMs);
      const [recent] = await db
        .select({ id: sponsorAdLogs.id })
        .from(sponsorAdLogs)
        .where(
          and(
            eq(sponsorAdLogs.adId, adId),
            eq(sponsorAdLogs.eventType, eventType),
            eq(sponsorAdLogs.sessionHash, sessionHash),
            gt(sponsorAdLogs.createdAt, since)
          )
        )
        .limit(1);
      isDuplicate = !!recent;
    }

    // Always log the raw event for analytics, even duplicates.
    await db.insert(sponsorAdLogs).values({
      adId,
      eventType,
      placement,
      sessionHash,
      createdAt: new Date(),
    });

    // Only duplicates skip the billed/aggregate counters below.
    if (!isDuplicate) {
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
            status: sponsorAds.status,
            advertiserEmail: sponsorAds.advertiserEmail,
            title: sponsorAds.title,
          })
          .from(sponsorAds)
          .where(eq(sponsorAds.id, adId));

        if (current && current.served >= current.total && current.status !== 'completed') {
          await db
            .update(sponsorAds)
            .set({
              status: 'completed',
              completedAt: new Date(),
            })
            .where(eq(sponsorAds.id, adId));

          try {
            await sendNotificationEmail({
              to: current.advertiserEmail,
              heading: 'Your sponsor campaign has finished delivering',
              message: `Your campaign "${current.title}" has served all ${current.total.toLocaleString()} purchased impressions. You can buy more impressions to keep it running from your dashboard.`,
              actionText: 'View campaign dashboard',
              actionUrl: `${getAppUrl()}/advertise/campaign/${adId}`,
            });
          } catch (emailErr) {
            console.error('[ads/event] completion email failed:', emailErr);
          }
        }
      } else if (eventType === 'click') {
        await db
          .update(sponsorAds)
          .set({
            clicksCount: sql`${sponsorAds.clicksCount} + 1`,
          })
          .where(eq(sponsorAds.id, adId));
      }
    }

    return NextResponse.json({ ok: true, deduped: isDuplicate });
  } catch (err: any) {
    console.error('[ads/event] error:', err?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
