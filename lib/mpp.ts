import { Receipt } from 'mppx';
import { Mppx, stripe } from 'mppx/server';
import { getStripe } from '@/lib/stripe';

/**
 * Machine Payments Protocol (https://mpp.dev): the second way an agent can pay
 * our paid endpoints, next to x402. An unpaid request gets a
 * `WWW-Authenticate: Payment method="stripe"` challenge; the agent answers
 * with `Authorization: Payment <credential>` carrying a Stripe shared payment
 * token (SPT), and mppx creates and confirms the PaymentIntent on our Stripe
 * account before anything is fulfilled.
 *
 * Off until all three are set: MPP_SECRET_KEY (signs challenges), the
 * STRIPE_PROFILE_ID of our Stripe Business Network profile, and
 * STRIPE_SECRET_KEY. See https://docs.stripe.com/payments/machine/mpp.
 */

type MppConfig = {
  secretKey: string;
  networkId: string;
  stripeSecretKey: string;
};

type MppReceipt = {
  /** The Stripe PaymentIntent (or other) reference from the MPP receipt. */
  reference: string;
  amountCents: number;
};

type MppSale = {
  priceCents: number;
  description: string;
  fulfill: (receipt: MppReceipt) => Promise<Record<string, unknown>>;
};

function pick(env: unknown, key: string): string | undefined {
  const v =
    (env as Record<string, unknown> | undefined)?.[key] ?? process.env[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Null when MPP isn't configured for this environment. */
export function getMppConfig(env: unknown): MppConfig | null {
  const secretKey = pick(env, 'MPP_SECRET_KEY');
  const networkId = pick(env, 'STRIPE_PROFILE_ID');
  const stripeSecretKey = pick(env, 'STRIPE_SECRET_KEY');
  if (!secretKey || !networkId || !stripeSecretKey) return null;
  return { secretKey, networkId, stripeSecretKey };
}

/** What discovery docs (pricing API, OpenAPI) say about MPP. */
export function mppStatus(env: unknown) {
  if (!getMppConfig(env)) return { enabled: false as const };
  return {
    enabled: true as const,
    method: 'stripe',
    intent: 'charge',
    currency: 'usd',
    credential: 'Stripe shared payment token (spt_...)',
  };
}

function createMppx(config: MppConfig) {
  return Mppx.create({
    methods: [
      stripe.charge({
        client: getStripe(config.stripeSecretKey),
        networkId: config.networkId,
        paymentMethodTypes: ['card'],
        currency: 'usd',
        decimals: 2,
      }),
    ],
    secretKey: config.secretKey,
    realm: 'allmcps.com',
  });
}

// One instance per config per isolate.
const instances = new Map<string, ReturnType<typeof createMppx>>();

function getMppx(config: MppConfig) {
  const key = `${config.networkId}|${config.secretKey}`;
  let mppx = instances.get(key);
  if (!mppx) {
    mppx = createMppx(config);
    instances.set(key, mppx);
  }
  return mppx;
}

/** True when the request carries an MPP credential (`Authorization: Payment ...`). */
export function hasMppCredential(req: Request): boolean {
  return /^payment\s/i.test(req.headers.get('authorization') ?? '');
}

/**
 * Sells one thing over MPP. Without a credential it answers 402 with the
 * challenge; with one, mppx verifies it and charges the SPT, and `fulfill`
 * runs only after that succeeds.
 */
export async function sellWithMpp(
  req: Request,
  config: MppConfig,
  sale: MppSale,
): Promise<Response> {
  const result = await getMppx(config).charge({
    amount: (sale.priceCents / 100).toFixed(2),
    description: sale.description,
  })(req);
  if (result.status === 402) return result.challenge as Response;

  // The receipt header carries the PaymentIntent reference we store with
  // the order; read it before fulfilling.
  const probe = result.withReceipt(new Response(null)) as Response;
  const encoded = probe.headers.get('Payment-Receipt');
  const reference = encoded ? Receipt.deserialize(encoded).reference : '';

  const body = await sale.fulfill({ reference, amountCents: sale.priceCents });
  return result.withReceipt(
    Response.json(body, { headers: { 'Cache-Control': 'private, no-store' } }),
  ) as Response;
}
