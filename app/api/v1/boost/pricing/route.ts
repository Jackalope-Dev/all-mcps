import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import {
  AGENT_PROMO_CODE,
  agentPriceCents,
  FREE_TIER,
  formatUsd,
  isOneTimeBoostSku,
  PAID_PRODUCTS,
} from '@/lib/pricing';
import { x402Status } from '@/lib/x402';

// Reads secrets at request time: x402 is only advertised once it's configured.
export const dynamic = 'force-dynamic';

export async function GET() {
  const { env } = await getCloudflareContext();
  const x402 = x402Status(env);
  const tiers = Object.values(PAID_PRODUCTS).map((p) => ({
    sku: p.sku,
    name: p.name,
    tagline: p.tagline,
    price_formatted: formatUsd(p.unitAmount),
    amount_cents: p.unitAmount,
    agent_price_formatted: formatUsd(agentPriceCents(p.unitAmount)),
    interval: p.interval,
    mode: p.mode,
    payment_methods: [
      'stripe_checkout',
      ...(x402.enabled && isOneTimeBoostSku(p.sku) ? ['x402'] : []),
    ],
    ...(p.weeklyTiers
      ? { weekly_tiers: p.weeklyTiers, max_weeks: p.maxWeeks ?? 8 }
      : {}),
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
          code: AGENT_PROMO_CODE,
          discount_percent: 50,
          description:
            'Exclusive 50% off for AI agents on one-time and subscription server boosting',
        },
        agent_commerce_support: {
          stripe_checkout: {
            endpoint: 'https://allmcps.com/api/v1/boost/checkout',
            method: 'POST',
            body: '{ serverId, sku, weeks?, email?, coupon? }',
            note: 'Returns a Stripe checkout URL for a human to complete. AGENTREADY is applied when passed (and by default).',
          },
          x402: x402.enabled
            ? {
                ...x402,
                note: 'POST { serverId, sku, weeks?, email? } to boost_endpoint; answer the 402 with a PAYMENT-SIGNATURE header. Agent price (50% off) is built in. Premium (subscription) is Stripe-only.',
              }
            : { enabled: false },
          mcp_tool: 'boost_mcp_server',
        },
        tiers,
      },
      null,
      2,
    ),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
}
