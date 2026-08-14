import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { sponsorAds, sponsorAdLogs } from '@/db/schema';
import { eq, and, gt, count, sql } from 'drizzle-orm';
import { hashVisitorForServer, getClientIp } from '@/lib/upvoteHash';
import { sendNotificationEmail } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';
import { verifyAdEventToken } from '@/lib/adEventToken';

export const dynamic = 'force-dynamic';

// Repeated page loads / rage-clicks from the same visitor shouldn't burn through
// an advertiser's purchased credits or inflate CTR.
const IMPRESSION_DEDUP_WINDOW_MS = 10 * 60 * 1000;
const CLICK_DEDUP_WINDOW_MS = 30 * 1000;

// Backstop against a single leaked/replayed event token being hammered
// rapidly — generous enough to never trip on real traffic for one ad, tight
// enough to blunt a scripted replay burst. Independent of the per-visitor
// dedup above, which only limits repeats from one IP.
const AD_BURST_WINDOW_MS = 60 * 1000;
const AD_BURST_MAX_EVENTS = 300;

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

    // Rejects events that don't carry a valid token minted by /api/ads/serve
    // for this exact adId — someone POSTing a scraped adId directly (e.g. a
    // competitor trying to burn through another advertiser's impression
    // credits) never receives a token to begin with.
    const tokenValid = await verifyAdEventToken(adId, body.eventToken, ctx.env as any);
    if (!tokenValid) {
      return NextResponse.json({ error: 'Invalid or expired event token' }, { status: 403 });
    }

    const db = drizzle(ctx.env.DB);

    // Backstop against a single valid token being replayed rapidly — caps
    // total event volume for one ad regardless of visitor/IP diversity.
    const [burst] = await db
      .select({ n: count() })
      .from(sponsorAdLogs)
      .where(and(eq(sponsorAdLogs.adId, adId), gt(sponsorAdLogs.createdAt, new Date(Date.now() - AD_BURST_WINDOW_MS))));
    if ((burst?.n ?? 0) >= AD_BURST_MAX_EVENTS) {
      return NextResponse.json({ error: 'Too many events for this ad recently' }, { status: 429 });
    }

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
