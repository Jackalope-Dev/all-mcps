import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import {
  AGENT_PROMO_CODE,
  formatUsd,
  isOneTimeBoostSku,
  PAID_PRODUCTS,
  type PaidSku,
} from '@/lib/pricing';
import { createStripeCheckoutSession } from '@/lib/stripeCheckout';
import { x402Status } from '@/lib/x402';

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
    const { serverId, sku = 'featured_7d', email, coupon } = body || {};

    if (!serverId) {
      return NextResponse.json(
        { error: 'serverId parameter is required' },
        { status: 400 },
      );
    }

    const product = PAID_PRODUCTS[sku as PaidSku];
    if (!product) {
      return NextResponse.json(
        {
          error: `Invalid SKU "${sku}". Valid options: priority_review, featured_7d, category_sponsor_7d, premium_monthly`,
        },
        { status: 400 },
      );
    }

    const effectiveCoupon = String(coupon || AGENT_PROMO_CODE).toUpperCase();
    const checkoutResult = await createStripeCheckoutSession({
      serverId,
      sku: sku as PaidSku,
      email,
      weeks: body?.weeks,
      coupon: effectiveCoupon,
      env,
    });

    if (!checkoutResult.success || !checkoutResult.url) {
      return NextResponse.json(
        {
          error: checkoutResult.error || 'Could not create checkout session',
          ...(checkoutResult.hint ? { hint: checkoutResult.hint } : {}),
        },
        { status: checkoutResult.status || 500 },
      );
    }

    const x402 = x402Status(env);
    return NextResponse.json({
      success: true,
      serverId,
      sku,
      product: product.name,
      // Read back from the Stripe session, so it's what the buyer will pay.
      amount_due:
        checkoutResult.amountTotalCents != null
          ? formatUsd(checkoutResult.amountTotalCents)
          : null,
      coupon: effectiveCoupon,
      coupon_applied: checkoutResult.promoApplied === true,
      checkout_url: checkoutResult.url,
      session_id: checkoutResult.sessionId,
      ...(x402.enabled && isOneTimeBoostSku(sku)
        ? {
            x402: {
              endpoint: x402.boost_endpoint,
              method: 'POST',
              body: { serverId, sku, weeks: body?.weeks ?? 1 },
              note: 'Pay in USDC instead of opening the checkout link: POST this body, answer the 402 challenge with a PAYMENT-SIGNATURE header. Agent price applies automatically.',
            },
          }
        : {}),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
