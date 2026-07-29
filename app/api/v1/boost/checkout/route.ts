import { NextResponse } from 'next/server';
import { PAID_PRODUCTS, formatUsd, type PaidSku } from '@/lib/pricing';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;
    const { serverId, sku = 'featured_7d', email, coupon = 'AGENTREADY' } = body || {};

    if (!serverId) {
      return NextResponse.json({ error: 'serverId parameter is required' }, { status: 400 });
    }

    const product = PAID_PRODUCTS[sku as PaidSku];
    if (!product) {
      return NextResponse.json(
        {
          error: `Invalid SKU "${sku}". Valid options: priority_review, featured_7d, premium_monthly`,
        },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://allmcps.com';
    const effectiveCoupon = (coupon || 'AGENTREADY').toUpperCase();
    const isAgentReadyPromo = effectiveCoupon === 'AGENTREADY';
    const discountedCents = isAgentReadyPromo ? Math.round(product.unitAmount * 0.5) : product.unitAmount;

    // Attempt Stripe session creation via internal endpoint
    try {
      const checkoutRes = await fetch(`${appUrl}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, sku, email }),
      });

      if (checkoutRes.ok) {
        const data = (await checkoutRes.json()) as any;
        if (data.url) {
          const promoUrl = `${data.url}${data.url.includes('?') ? '&' : '?'}prefilled_promo_code=${effectiveCoupon}`;
          return NextResponse.json({
            success: true,
            serverId,
            sku,
            product: product.name,
            original_price: formatUsd(product.unitAmount),
            discounted_price: formatUsd(discountedCents),
            applied_coupon: effectiveCoupon,
            checkout_url: promoUrl,
            session_id: data.sessionId,
            x402_invoice: {
              spec: 'x402-v1',
              asset: 'USD',
              amount: discountedCents / 100,
              coupon: effectiveCoupon,
              payee: 'AllMCPs Directory',
              checkout_url: promoUrl,
            },
          });
        }
      }
    } catch {
      /* fallback below if fetch fails */
    }

    // Fallback checkout URL (pricing page)
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
