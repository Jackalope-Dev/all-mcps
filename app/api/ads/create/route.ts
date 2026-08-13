import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { sponsorAds } from '@/db/schema';
import { validateAdPayload, calculateAdCostCents, type AdPlacement } from '@/lib/ads';
import { isStripeConfigured } from '@/lib/pricing';
import { getStripe, getAppUrl } from '@/lib/stripe';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as any;
    const {
      title,
      description,
      ctaText = 'Learn More',
      targetUrl,
      logoUrl,
      placement = 'all',
      bidCpm = 500,
      impressions = 1000,
      advertiserEmail,
    } = body || {};

    const validation = validateAdPayload({
      title,
      description,
      ctaText,
      targetUrl,
      logoUrl,
      advertiserEmail,
      impressions: Number(impressions),
      bidCpm: Number(bidCpm),
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const costCents = calculateAdCostCents(Number(impressions), Number(bidCpm));
    const adId = crypto.randomUUID();

    // Best-effort account link: not required to create an ad, but if the
    // advertiser is signed in, this is what lets the campaign show up in
    // their /dashboard alongside their MCP listings.
    let advertiserUserId: string | null = null;
    try {
      const session = await auth();
      advertiserUserId = session?.user?.id || null;
    } catch {
      // no-op — ad creation shouldn't fail just because session lookup did
    }

    const ctx = await getCloudflareContext();
    if (!ctx?.env?.DB) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    const db = drizzle(ctx.env.DB);
    const stripeConfigured = isStripeConfigured(ctx.env);

    // If Stripe is configured and payment is required, we can generate a Stripe Checkout Session
    if (stripeConfigured) {
      try {
        const stripe = getStripe((ctx.env as any)?.STRIPE_SECRET_KEY);
        const appUrl = getAppUrl();

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          customer_email: String(advertiserEmail).trim(),
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `AllMCPs Sponsor Campaign: ${String(title).trim()}`,
                  description: `${Number(impressions).toLocaleString()} impressions at $${(Number(bidCpm) / 100).toFixed(2)} CPM (${placement} placement)`,
                },
                unit_amount: costCents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            adId,
            advertiserEmail: String(advertiserEmail).trim(),
            placement,
            impressions: String(impressions),
            bidCpm: String(bidCpm),
          },
          invoice_creation: { enabled: true },
          success_url: `${appUrl}/advertise/campaign/${adId}?payment=success`,
          cancel_url: `${appUrl}/advertise/create?canceled=1`,
        });

        // Insert pending ad row linked to Stripe session
        await db.insert(sponsorAds).values({
          id: adId,
          advertiserEmail: String(advertiserEmail).trim().toLowerCase(),
          advertiserUserId,
          title: String(title).trim(),
          description: String(description).trim(),
          ctaText: String(ctaText).trim() || 'Learn More',
          targetUrl: String(targetUrl).trim(),
          logoUrl: String(logoUrl).trim(),
          placement: placement as AdPlacement,
          bidCpm: Number(bidCpm),
          totalImpressionsPurchased: Number(impressions),
          impressionsServed: 0,
          clicksCount: 0,
          status: 'pending_approval',
          stripeSessionId: session.id,
          amountPaidCents: costCents,
          createdAt: new Date(),
        });

        return NextResponse.json({
          success: true,
          adId,
          checkoutUrl: session.url,
          redirectUrl: session.url,
        });
      } catch (stripeErr: any) {
        console.error('[ads/create] Stripe error, falling back to direct creation:', stripeErr?.message);
      }
    }

    // Direct insertion (for dev/preview or when Stripe is handled separately)
    await db.insert(sponsorAds).values({
      id: adId,
      advertiserEmail: String(advertiserEmail).trim().toLowerCase(),
      advertiserUserId,
      title: String(title).trim(),
      description: String(description).trim(),
      ctaText: String(ctaText).trim() || 'Learn More',
      targetUrl: String(targetUrl).trim(),
      logoUrl: String(logoUrl).trim(),
      placement: placement as AdPlacement,
      bidCpm: Number(bidCpm),
      totalImpressionsPurchased: Number(impressions),
      impressionsServed: 0,
      clicksCount: 0,
      status: 'pending_approval',
      amountPaidCents: costCents,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      adId,
      redirectUrl: `/advertise/campaign/${adId}?submitted=1`,
    });
  } catch (err: any) {
    console.error('[ads/create] error:', err?.message);
    return NextResponse.json({ error: 'Failed to create ad campaign' }, { status: 500 });
  }
}
