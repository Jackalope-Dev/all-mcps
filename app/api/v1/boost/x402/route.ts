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
  getMachinePaymentConfig,
  sellWithMachinePayments,
} from '@/lib/machinePayments';
import {
  agentPriceCents,
  clampWeeks,
  formatUsd,
  isOneTimeBoostSku,
  ONE_TIME_BOOST_SKUS,
  PAID_PRODUCTS,
  tieredTotal,
} from '@/lib/pricing';

export const dynamic = 'force-dynamic';

/**
 * Buy a boost with x402 or MPP. POST { serverId, sku, weeks?, email? } — the first
 * call answers 402 with the price; retry the same request with a
 * PAYMENT-SIGNATURE (x402) or Authorization: Payment (MPP) header to pay.
 * The boost turns on once payment settles.
 */
export async function POST(req: Request) {
  const { env } = await getCloudflareContext();
  const config = getMachinePaymentConfig(env);
  if (!config) {
    return NextResponse.json(
      {
        error:
          'Agent payments (x402, MPP) are not enabled yet. Use POST /api/v1/boost/checkout for a Stripe checkout link.',
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
            ? 'Premium is a monthly subscription, which agent payments cannot bill. Use POST /api/v1/boost/checkout instead.'
            : `Invalid sku. Agent payments accept: ${ONE_TIME_BOOST_SKUS.join(', ')}`,
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

  return sellWithMachinePayments(req, config, {
    priceCents,
    description: `${product.name}${span} for "${server.name}" on AllMCPs (${formatUsd(listCents)} list, agent price ${formatUsd(priceCents)})`,
    resourceUrl: new URL(req.url).toString(),
    metadata: { serverId, sku, weeks: String(weeks) },
    discovery: {
      bodyType: 'json',
      input: { serverId: 'github-mcp-server', sku: 'featured_7d', weeks: 1 },
      inputSchema: {
        type: 'object',
        properties: {
          serverId: {
            type: 'string',
            description: 'AllMCPs listing id (the slug in /mcp/<id>)',
          },
          sku: { type: 'string', enum: [...ONE_TIME_BOOST_SKUS] },
          weeks: { type: 'integer', minimum: 1 },
          email: { type: 'string', description: 'Optional receipt email' },
        },
        required: ['serverId', 'sku'],
      },
      output: {
        example: {
          serverId: 'github-mcp-server',
          sku: 'featured_7d',
          weeks: 1,
          featuredUntil: '2026-12-01T00:00:00.000Z',
          listing: 'https://allmcps.com/mcp/github-mcp-server',
        },
      },
    },
    fulfill: async (receipt) => {
      const updated = await fulfillBoostPurchase(db, {
        serverId,
        sku,
        weeks,
        amountCents: receipt.amountCents,
        attribution: attributionFromRequest(req),
        paymentRef: receipt.paymentRef,
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
