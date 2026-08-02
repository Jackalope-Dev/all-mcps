import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { PAID_PRODUCTS, formatUsd, type PaidSku } from '@/lib/pricing';
import { createStripeCheckoutSession } from '@/lib/stripeCheckout';

export async function POST(req: Request) {
  try {
    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      /* fallback */
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const { serverId, sku = 'featured_7d', email, coupon = 'AGENTREADY' } = body || {};

    if (!serverId) {
      return NextResponse.json({ error: 'serverId parameter is required' }, { status: 400 });
    }

    const product = PAID_PRODUCTS[sku as PaidSku];
    if (!product) {
      return NextResponse.json(
        {
          error: `Invalid SKU "${sku}". Valid options: priority_review, featured_7d, category_sponsor_7d, premium_monthly`,
        },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://allmcps.com';
    const effectiveCoupon = (coupon || 'AGENTREADY').toUpperCase();
    const isAgentReadyPromo = effectiveCoupon === 'AGENTREADY';
    const discountedCents = isAgentReadyPromo ? Math.round(product.unitAmount * 0.5) : product.unitAmount;

    // Call direct Stripe session creation helper in-memory (no HTTP fetch subrequest overhead)
    const checkoutResult = await createStripeCheckoutSession({
      serverId,
      sku: sku as PaidSku,
      email,
      coupon: effectiveCoupon,
      env,
    });

    if (checkoutResult.success && checkoutResult.url) {
      return NextResponse.json({
        success: true,
        serverId,
        sku,
        product: product.name,
        original_price: formatUsd(product.unitAmount),
        discounted_price: formatUsd(discountedCents),
        applied_coupon: effectiveCoupon,
        checkout_url: checkoutResult.url,
        session_id: checkoutResult.sessionId,
        x402_invoice: {
          spec: 'x402-v1',
          asset: 'USD',
          amount: discountedCents / 100,
          coupon: effectiveCoupon,
          payee: 'AllMCPs Directory',
          checkout_url: checkoutResult.url,
        },
      });
    }

    // Fallback checkout URL (pricing page) if Stripe secrets are not yet configured in env
    const fallbackCheckoutUrl = `${appUrl}/pricing?serverId=${encodeURIComponent(serverId)}&sku=${sku}&coupon=${effectiveCoupon}`;
    return NextResponse.json({
      success: true,
      serverId,
      sku,
      product: product.name,
      original_price: formatUsd(product.unitAmount),
      discounted_price: formatUsd(discountedCents),
      applied_coupon: effectiveCoupon,
      checkout_url: fallbackCheckoutUrl,
      x402_invoice: {
        spec: 'x402-v1',
        asset: 'USD',
        amount: discountedCents / 100,
        coupon: effectiveCoupon,
        payee: 'AllMCPs Directory',
        checkout_url: fallbackCheckoutUrl,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
