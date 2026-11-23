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
import {
  getMachinePaymentConfig,
  sellWithMachinePayments,
} from '@/lib/machinePayments';
import { sendReceiptEmail } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';
import {
  hashSubmitterIp,
  requestIp,
  screenStatus,
  screenSubmitter,
} from '@/lib/submitterBlocks';

export const dynamic = 'force-dynamic';

/**
 * Buy a sponsor ad campaign with x402 or MPP. Same body as /api/ads/create
 * (title, description, ctaText, targetUrl, logoUrl, placement, bidCpm,
 * impressions, advertiserEmail). The first call answers 402 with the cost;
 * retry with PAYMENT-SIGNATURE (x402) or Authorization: Payment (MPP). The campaign is created only after
 * payment settles and then waits for the same admin review as any other ad.
 */
export async function POST(req: Request) {
  const { env } = await getCloudflareContext();
  const config = getMachinePaymentConfig(env);
  if (!config) {
    return NextResponse.json(
      {
        error:
          'Agent payments (x402, MPP) are not enabled yet. Create campaigns at https://allmcps.com/advertise/create.',
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

  // Before the 402 quote, so a blocked or unreachable buyer is never asked
  // to pay for a campaign that would then be refused.
  const advertiserIpHash = await hashSubmitterIp(requestIp(req));
  const screened = await screenSubmitter(
    drizzle(env.DB),
    {
      email: ad.advertiserEmail,
      ipHash: advertiserIpHash,
    },
    env,
  );
  if (screened) {
    return NextResponse.json(
      { error: screened },
      { status: screenStatus(screened) },
    );
  }

  const costCents = calculateAdCostCents(ad.impressions, ad.bidCpm);
  const adId = crypto.randomUUID();

  return sellWithMachinePayments(req, config, {
    priceCents: costCents,
    description: `AllMCPs sponsor campaign "${ad.title}": ${ad.impressions.toLocaleString()} impressions at ${formatUsdAmount(ad.bidCpm)} CPM (${placement} placement)`,
    resourceUrl: new URL(req.url).toString(),
    metadata: { adId, advertiserEmail: ad.advertiserEmail, placement },
    discovery: {
      bodyType: 'json',
      input: {
        title: 'Acme MCP',
        description: 'Ship MCP servers faster.',
        targetUrl: 'https://example.com',
        advertiserEmail: 'ads@example.com',
        placement: 'all',
        impressions: 1000,
        bidCpm: 500,
      },
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          ctaText: { type: 'string' },
          targetUrl: { type: 'string', format: 'uri' },
          logoUrl: { type: 'string', format: 'uri' },
          advertiserEmail: { type: 'string', format: 'email' },
          placement: { type: 'string', enum: Object.keys(AD_PLACEMENTS) },
          impressions: { type: 'integer', minimum: 1000 },
          bidCpm: {
            type: 'integer',
            minimum: 100,
            description: 'Cents per 1,000 impressions',
          },
        },
        required: ['title', 'description', 'targetUrl', 'advertiserEmail'],
      },
      output: {
        example: { adId: 'ad_123', status: 'pending_approval' },
      },
    },
    fulfill: async (receipt) => {
      const db = drizzle(env.DB);
      await db.insert(sponsorAds).values({
        id: adId,
        advertiserEmail: ad.advertiserEmail,
        advertiserIpHash,
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
        stripeSessionId: receipt.paymentRef,
      });

      const dashboardUrl = `${getAppUrl()}/advertise/campaign/${adId}`;
      try {
        await sendReceiptEmail({
          to: ad.advertiserEmail,
          receiptId: receipt.stripePaymentIntentId || receipt.paymentRef,
          date: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          amount: formatUsdAmount(receipt.amountCents),
          description: `AllMCPs Sponsor Campaign: ${ad.title} (paid with ${receipt.paidWith})`,
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
