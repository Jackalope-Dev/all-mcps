import { NextResponse } from 'next/server';
import { PAID_PRODUCTS, formatUsd } from '@/lib/pricing';

export async function GET() {
  const tiers = Object.values(PAID_PRODUCTS).map((p) => ({
    sku: p.sku,
    name: p.name,
    tagline: p.tagline,
    price_formatted: formatUsd(p.unitAmount),
    amount_cents: p.unitAmount,
    interval: p.interval,
    mode: p.mode,
    benefits: p.benefits,
  }));

  return new NextResponse(
    JSON.stringify(
      {
        currency: 'USD',
        provider: 'Stripe',
        agent_commerce_support: {
          x402_header: true,
          direct_checkout_link: true,
          mcp_tool: 'boost_mcp_server',
        },
        tiers,
      },
      null,
      2
    ),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
