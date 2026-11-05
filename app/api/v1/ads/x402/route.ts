import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { sponsorAds } from '@/db/schema';
import {
  AD_PLACEMENTS,
  type AdPlacement,
  calculateAdCostCents,
  formatUsdAmount,
  validateAdPayload,
} from '@/lib/ads';
import { attributionFromRequest } from '@/lib/attribution';
import { recordConversion } from '@/lib/conversions';
import { sendReceiptEmail } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';
import { getX402Config, sellWithX402 } from '@/lib/x402';

export const dynamic = 'force-dynamic';

/**
 * Buy a sponsor ad campaign with x402. Same body as /api/ads/create
 * (title, description, ctaText, targetUrl, logoUrl, placement, bidCpm,
 * impressions, advertiserEmail). The first call answers 402 with the cost;
 * retry with PAYMENT-SIGNATURE to pay. The campaign is created only after
 * payment settles and then waits for the same admin review as any other ad.
 */
export async function POST(req: Request) {
  const { env } = await getCloudflareContext();
  const config = getX402Config(env);
  if (!config) {
    return NextResponse.json(
      {
        error:
          'x402 payments are not enabled yet. Create campaigns at https://allmcps.com/advertise/create.',
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string, fallback = '') =>
    typeof body[k] === 'string' ? (body[k] as string).trim() : fallback;
  const ad = {
    title: str('title'),
    description: str('description'),
    ctaText: str('ctaText', 'Learn More') || 'Learn More',
    targetUrl: str('targetUrl'),
    logoUrl: str('logoUrl'),
    advertiserEmail: str('advertiserEmail').toLowerCase(),
    impressions: Number(body.impressions ?? 1000),
    bidCpm: Number(body.bidCpm ?? 500),
  };
  const placement = str('placement', 'all') as AdPlacement;
  if (!(placement in AD_PLACEMENTS)) {
    return NextResponse.json(
      {
        error: `Invalid placement. Options: ${Object.keys(AD_PLACEMENTS).join(', ')}`,
      },
      { status: 400 },
    );
  }

  const validation = validateAdPayload(ad);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const costCents = calculateAdCostCents(ad.impressions, ad.bidCpm);
  const adId = crypto.randomUUID();

  return sellWithX402(req, config, {
    priceCents: costCents,
    description: `AllMCPs sponsor campaign "${ad.title}": ${ad.impressions.toLocaleString()} impressions at ${formatUsdAmount(ad.bidCpm)} CPM (${placement} placement)`,
    resourceUrl: new URL(req.url).toString(),
    metadata: { adId, advertiserEmail: ad.advertiserEmail, placement },
    fulfill: async (receipt) => {
      const db = drizzle(env.DB);
      await db.insert(sponsorAds).values({
        id: adId,
        advertiserEmail: ad.advertiserEmail,
        title: ad.title,
        description: ad.description,
        ctaText: ad.ctaText,
        targetUrl: ad.targetUrl,
        logoUrl: ad.logoUrl,
        placement,
        bidCpm: ad.bidCpm,
        totalImpressionsPurchased: ad.impressions,
        status: 'pending_approval',
        stripePaymentIntentId: receipt.stripePaymentIntentId,
        amountPaidCents: receipt.amountCents,
        createdAt: new Date(),
      });

      await recordConversion(db, {
        kind: 'ad_purchase',
        adId,
        sku: 'sponsor_ad',
        amountCents: receipt.amountCents,
        attribution: attributionFromRequest(req),
        stripeSessionId: `x402:${receipt.transaction}`,
      });

      const dashboardUrl = `${getAppUrl()}/advertise/campaign/${adId}`;
      try {
        await sendReceiptEmail({
          to: ad.advertiserEmail,
          receiptId: receipt.stripePaymentIntentId || receipt.transaction,
          date: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          amount: formatUsdAmount(receipt.amountCents),
          description: `AllMCPs Sponsor Campaign: ${ad.title} (paid in USDC via x402)`,
          actionText: 'View campaign dashboard',
          actionUrl: dashboardUrl,
        });
      } catch (err) {
        console.error('[ads/x402] receipt email failed:', err);
      }

      return {
        adId,
        status: 'pending_approval',
        note: 'Campaigns are reviewed before they serve, usually within a day. If it is rejected, email support@allmcps.com for a refund.',
        dashboard: dashboardUrl,
      };
    },
  });
}
