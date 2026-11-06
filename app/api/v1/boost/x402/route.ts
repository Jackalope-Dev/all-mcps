import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '@/db/schema';
import { attributionFromRequest } from '@/lib/attribution';
import {
  boostEligibilityError,
  fulfillBoostPurchase,
} from '@/lib/boostPurchase';
import {
  agentPriceCents,
  clampWeeks,
  formatUsd,
  isOneTimeBoostSku,
  ONE_TIME_BOOST_SKUS,
  PAID_PRODUCTS,
  tieredTotal,
} from '@/lib/pricing';
import { getX402Config, sellWithX402 } from '@/lib/x402';

export const dynamic = 'force-dynamic';

/**
 * Buy a boost with x402. POST { serverId, sku, weeks?, email? } — the first
 * call answers 402 with the price; retry the same request with a
 * PAYMENT-SIGNATURE header to pay. The boost turns on once payment settles.
 */
export async function POST(req: Request) {
  const { env } = await getCloudflareContext();
  const config = getX402Config(env);
  if (!config) {
    return NextResponse.json(
      {
        error:
          'x402 payments are not enabled yet. Use POST /api/v1/boost/checkout for a Stripe checkout link.',
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    serverId?: unknown;
    sku?: unknown;
    weeks?: unknown;
    email?: unknown;
  };
  const serverId = typeof body.serverId === 'string' ? body.serverId : '';
  const sku = typeof body.sku === 'string' ? body.sku : 'featured_7d';
  const email =
    typeof body.email === 'string' && body.email.includes('@')
      ? body.email.trim().toLowerCase()
      : null;

  if (!serverId) {
    return NextResponse.json(
      { error: 'serverId is required' },
      { status: 400 },
    );
  }
  if (!isOneTimeBoostSku(sku)) {
    return NextResponse.json(
      {
        error:
          sku === 'premium_monthly'
            ? 'Premium is a monthly subscription, which x402 cannot bill. Use POST /api/v1/boost/checkout instead.'
            : `Invalid sku. x402 accepts: ${ONE_TIME_BOOST_SKUS.join(', ')}`,
      },
      { status: 400 },
    );
  }

  const db = drizzle(env.DB);
  const [server] = await db
    .select()
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  if (!server) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }
  const ineligible = await boostEligibilityError(db, server, sku);
  if (ineligible) {
    return NextResponse.json(
      { error: ineligible.error },
      { status: ineligible.status },
    );
  }

  const product = PAID_PRODUCTS[sku];
  const weeks = clampWeeks(product, body.weeks);
  const listCents = tieredTotal(product, weeks);
  const priceCents = agentPriceCents(listCents);
  const span = product.weeklyTiers
    ? ` for ${weeks} week${weeks === 1 ? '' : 's'}`
    : '';

  return sellWithX402(req, config, {
    priceCents,
    description: `${product.name}${span} for "${server.name}" on AllMCPs (${formatUsd(listCents)} list, agent price ${formatUsd(priceCents)})`,
    resourceUrl: new URL(req.url).toString(),
    metadata: { serverId, sku, weeks: String(weeks) },
    fulfill: async (receipt) => {
      const updated = await fulfillBoostPurchase(db, {
        serverId,
        sku,
        weeks,
        amountCents: receipt.amountCents,
        attribution: attributionFromRequest(req),
        paymentRef: `x402:${receipt.transaction}`,
        email,
      });
      return {
        serverId,
        sku,
        weeks,
        featuredUntil: updated?.featuredUntil ?? null,
        categorySponsorUntil: updated?.categorySponsorUntil ?? null,
        reviewPriority: updated?.reviewPriority ?? null,
        listing: `https://allmcps.com/mcp/${encodeURIComponent(serverId)}`,
      };
    },
  });
}
