import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { sponsorAds } from '@/db/schema';
import { eq, or, and, lt } from 'drizzle-orm';
import { selectWeightedAd, type AdPlacement } from '@/lib/ads';
import { mintAdEventToken } from '@/lib/adEventToken';

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

    // Keep self-promotion active: reserve ~15% of views for house sponsor promo cards
    const HOUSE_PROMO_RATE = 0.15;
    if (Math.random() < HOUSE_PROMO_RATE) {
      return NextResponse.json({ ad: null, isHousePromo: true });
    }

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
          lt(sponsorAds.impressionsServed, sponsorAds.totalImpressionsPurchased),
          placement === 'all'
            ? undefined
            : or(eq(sponsorAds.placement, placement), eq(sponsorAds.placement, 'all'))
        )
      );

    if (!candidateAds || candidateAds.length === 0) {
      return NextResponse.json({ ad: null });
    }

    // Deduplication: Avoid serving an ad that is already active on this page
    let eligible = candidateAds;
    if (excludeIds.length > 0) {
      const notExcluded = candidateAds.filter((ad) => !excludeIds.includes(ad.id));
      if (notExcluded.length > 0) {
        eligible = notExcluded;
      } else {
        // If all candidates are already rendered on this page, show promo unit to prevent duplicate visual clutter
        return NextResponse.json({ ad: null, isHousePromo: true });
      }
    }

    const chosenAd = selectWeightedAd(eligible);
    if (!chosenAd) {
      return NextResponse.json({ ad: null });
    }

    const eventToken = await mintAdEventToken(chosenAd.id, ctx.env as any);
    return NextResponse.json({ ad: chosenAd, eventToken });
  } catch (err: any) {
    console.error('[ads/serve] error:', err?.message);
    return NextResponse.json({ ad: null });
  }
}
