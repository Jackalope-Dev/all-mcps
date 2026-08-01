import { NextResponse } from 'next/server';
import { PAID_PRODUCTS, FREE_TIER, formatUsd } from '@/lib/pricing';

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
        free_tier: {
          sku: FREE_TIER.sku,
          name: FREE_TIER.name,
          tagline: FREE_TIER.tagline,
          price_formatted: formatUsd(FREE_TIER.unitAmount),
          amount_cents: FREE_TIER.unitAmount,
          benefits: FREE_TIER.benefits,
          submit_url: 'https://allmcps.com/submit',
          submit_api: 'https://allmcps.com/api/submit',
          note: 'Listing on AllMCPs is always free. Boosts below are optional upgrades.',
        },
        agent_exclusive_promo: {
          code: 'AGENTREADY',
          discount_percent: 50,
          description: 'Exclusive 50% off for AI agents on one-time and subscription server boosting',
        },
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
