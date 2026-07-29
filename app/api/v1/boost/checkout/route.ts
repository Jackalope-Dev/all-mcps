import { NextResponse } from 'next/server';
import { PAID_PRODUCTS, formatUsd, type PaidSku } from '@/lib/pricing';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;
    const { serverId, sku = 'featured_7d', email } = body || {};

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

    // Call existing Stripe checkout endpoint internally or generate session URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://allmcps.com';
    const checkoutRes = await fetch(`${appUrl}/api/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, sku, email }),
    });

    if (checkoutRes.ok) {
      const data = (await checkoutRes.json()) as any;
      return NextResponse.json({
        success: true,
        serverId,
        sku,
        product: product.name,
        price: formatUsd(product.unitAmount),
        checkout_url: data.url,
        session_id: data.sessionId,
        x402_invoice: {
          spec: 'x402-v1',
          asset: 'USD',
          amount: product.unitAmount / 100,
          payee: 'AllMCPs Directory',
          checkout_url: data.url,
        },
      });
    }

    const errData = (await checkoutRes.json()) as any;
    return NextResponse.json(
      {
        success: false,
        error: errData.error || 'Could not initiate checkout session',
        checkout_url: `${appUrl}/pricing?serverId=${encodeURIComponent(serverId)}`,
      },
      { status: checkoutRes.status }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
