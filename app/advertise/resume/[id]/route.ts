import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { sponsorAds } from '@/db/schema';
import { isStripeConfigured } from '@/lib/pricing';
import { getStripe, getAppUrl } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * Mints a fresh Stripe Checkout Session for an existing unpaid ad and redirects
 * to it. A saved Checkout Session URL goes stale after Stripe's 24h expiry, so
 * the abandoned-checkout reminder email links here instead of to the original
 * session — every visit gets a live link, however long after the email was sent.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUrl = getAppUrl();

  const ctx = await getCloudflareContext();
  if (!ctx?.env?.DB) {
    return NextResponse.redirect(`${appUrl}/advertise/create`);
  }

  const db = drizzle(ctx.env.DB);
  const [ad] = await db.select().from(sponsorAds).where(eq(sponsorAds.id, id)).limit(1);

  if (!ad) {
    return NextResponse.redirect(`${appUrl}/advertise/create`);
  }

  // Already paid, approved, rejected, etc. — nothing to resume, send them to the dashboard.
  if (ad.stripePaymentIntentId || ad.status !== 'pending_approval') {
    return NextResponse.redirect(`${appUrl}/advertise/campaign/${id}`);
  }

  if (!isStripeConfigured(ctx.env)) {
    return NextResponse.redirect(`${appUrl}/advertise/campaign/${id}?error=payment_unavailable`);
  }

  try {
    const stripe = getStripe((ctx.env as any)?.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: ad.advertiserEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `AllMCPs Sponsor Campaign: ${ad.title}`,
              description: `${ad.totalImpressionsPurchased.toLocaleString()} impressions at $${(ad.bidCpm / 100).toFixed(2)} CPM (${ad.placement} placement)`,
            },
            unit_amount: ad.amountPaidCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        adId: ad.id,
        advertiserEmail: ad.advertiserEmail,
        placement: ad.placement,
        impressions: String(ad.totalImpressionsPurchased),
        bidCpm: String(ad.bidCpm),
      },
      invoice_creation: { enabled: true },
      success_url: `${appUrl}/advertise/campaign/${ad.id}?payment=success`,
      cancel_url: `${appUrl}/advertise/create?canceled=1`,
    });

    await db
      .update(sponsorAds)
      .set({ stripeSessionId: session.id })
      .where(eq(sponsorAds.id, id));

    if (!session.url) {
      return NextResponse.redirect(`${appUrl}/advertise/campaign/${id}?error=payment_unavailable`);
    }

    return NextResponse.redirect(session.url);
  } catch (err: any) {
    console.error('[advertise/resume] error:', err?.message);
    return NextResponse.redirect(`${appUrl}/advertise/campaign/${id}?error=payment_unavailable`);
  }
}
