import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, eq, lt, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { sponsorAds } from '@/db/schema';
import { mintAdEventToken } from '@/lib/adEventToken';
import { type AdPlacement, pickAdForSlot } from '@/lib/ads';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const placement = (searchParams.get('placement') || 'all') as AdPlacement;
    const excludeParam = searchParams.get('exclude') || '';
    const excludeIds = excludeParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const ctx = await getCloudflareContext();
    if (!ctx?.env?.DB) {
      return NextResponse.json({ ad: null });
    }

    const db = drizzle(ctx.env.DB);

    // Fetch active approved ads with remaining impressions
    const candidateAds = await db
      .select()
      .from(sponsorAds)
      .where(
        and(
          eq(sponsorAds.status, 'active'),
          lt(
            sponsorAds.impressionsServed,
            sponsorAds.totalImpressionsPurchased,
          ),
          placement === 'all'
            ? undefined
            : or(
                eq(sponsorAds.placement, placement),
                eq(sponsorAds.placement, 'all'),
              ),
        ),
      );

    // Paid ads always win the slot; the house promo card is only the fallback
    // when no ad has impressions left (see pickAdForSlot).
    const chosenAd = pickAdForSlot(candidateAds, excludeIds);
    if (!chosenAd) {
      return NextResponse.json({ ad: null, isHousePromo: true });
    }

    const eventToken = await mintAdEventToken(chosenAd.id, ctx.env as any);
    return NextResponse.json({ ad: chosenAd, eventToken });
  } catch (err: any) {
    console.error('[ads/serve] error:', err?.message);
    return NextResponse.json({ ad: null });
  }
}
