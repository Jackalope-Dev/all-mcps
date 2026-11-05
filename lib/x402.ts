import { createFacilitatorConfig } from '@coinbase/x402';
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from '@x402/core/http';
import {
  type FacilitatorConfig,
  HTTPFacilitatorClient,
  x402ResourceServer,
} from '@x402/core/server';
import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
} from '@x402/core/types';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

/**
 * x402 (https://x402.org) lets an agent pay over plain HTTP: we answer 402
 * with a PAYMENT-REQUIRED challenge, the agent signs a USDC transfer and
 * retries with PAYMENT-SIGNATURE, and a facilitator settles it on-chain.
 *
 * Funds land at a Stripe crypto deposit address (X402_PAY_TO), and each
 * settled transfer is recorded as a Stripe PaymentIntent, so x402 revenue
 * shows up in the same dashboard, payouts and reports as card payments.
 * See https://docs.stripe.com/payments/machine/x402.
 *
 * Off until X402_PAY_TO is set. Every place that advertises x402 reads
 * x402Status() so we never claim it while it can't take a payment.
 */

const BASE_MAINNET: Network = 'eip155:8453';
const BASE_SEPOLIA: Network = 'eip155:84532';
const PUBLIC_TEST_FACILITATOR = 'https://x402.org/facilitator';
/** Machine payments need a preview API version (docs.stripe.com/payments/machine/x402). */
const STRIPE_MACHINE_PAYMENTS_API_VERSION = '2026-05-27.preview';
/** USDC has 6 decimals: 1 cent = 10,000 atomic units. */
const USDC_ATOMIC_PER_CENT = 10_000;

type X402Env = {
  X402_PAY_TO?: string;
  X402_NETWORK?: string;
  X402_FACILITATOR_URL?: string;
  CDP_API_KEY_ID?: string;
  CDP_API_KEY_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
};

type X402Config = {
  payTo: string;
  network: Network;
  facilitator: FacilitatorConfig;
  stripeSecretKey: string | null;
};

function readEnv(env: unknown): X402Env {
  const e = (env ?? {}) as Record<string, unknown>;
  const pick = (k: keyof X402Env) => {
    const v = e[k] ?? process.env[k];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  return {
    X402_PAY_TO: pick('X402_PAY_TO'),
    X402_NETWORK: pick('X402_NETWORK'),
    X402_FACILITATOR_URL: pick('X402_FACILITATOR_URL'),
    CDP_API_KEY_ID: pick('CDP_API_KEY_ID'),
    CDP_API_KEY_SECRET: pick('CDP_API_KEY_SECRET'),
    STRIPE_SECRET_KEY: pick('STRIPE_SECRET_KEY'),
  };
}

/** Null when x402 isn't configured (or is misconfigured) for this environment. */
export function getX402Config(env: unknown): X402Config | null {
  const e = readEnv(env);
  const payTo = e.X402_PAY_TO?.toLowerCase();
  if (!payTo || !/^0x[0-9a-f]{40}$/.test(payTo)) return null;

  const network = (e.X402_NETWORK || BASE_MAINNET) as Network;
  if (network !== BASE_MAINNET && network !== BASE_SEPOLIA) return null;

  let facilitator: FacilitatorConfig;
  if (e.X402_FACILITATOR_URL) {
    facilitator = { url: e.X402_FACILITATOR_URL };
  } else if (network === BASE_SEPOLIA) {
    facilitator = { url: PUBLIC_TEST_FACILITATOR };
  } else if (e.CDP_API_KEY_ID && e.CDP_API_KEY_SECRET) {
    // Mainnet settles through Coinbase's facilitator, which needs CDP keys.
    facilitator = createFacilitatorConfig(
      e.CDP_API_KEY_ID,
      e.CDP_API_KEY_SECRET,
    );
  } else {
    return null;
  }

  return {
    payTo,
    network,
    facilitator,
    stripeSecretKey: e.STRIPE_SECRET_KEY ?? null,
  };
}

/** What discovery docs (pricing API, server card, skills) say about x402. */
export function x402Status(env: unknown) {
  const config = getX402Config(env);
  if (!config) return { enabled: false as const };
  return {
    enabled: true as const,
    version: 2,
    scheme: 'exact',
    network: config.network,
    asset: 'USDC',
    boost_endpoint: 'https://allmcps.com/api/v1/boost/x402',
    ads_endpoint: 'https://allmcps.com/api/v1/ads/x402',
  };
}

// One initialized server per facilitator config per isolate; initialize()
// fetches the facilitator's /supported list, so don't repeat it per request.
const servers = new Map<string, Promise<x402ResourceServer>>();

function getResourceServer(config: X402Config): Promise<x402ResourceServer> {
  const key = `${config.network}|${config.facilitator.url ?? 'cdp'}`;
  let server = servers.get(key);
  if (!server) {
    server = (async () => {
      const s = new x402ResourceServer(
        new HTTPFacilitatorClient(config.facilitator),
      ).register(config.network, new ExactEvmScheme());
      await s.initialize();
      return s;
    })();
    servers.set(key, server);
    server.catch(() => servers.delete(key));
  }
  return server;
}

type X402Receipt = {
  transaction: string;
  network: string;
  payer: string | null;
  amountCents: number;
  /** Stripe PaymentIntent recording the transfer; null if recording failed (funds still arrived). */
  stripePaymentIntentId: string | null;
};

type X402Sale = {
  priceCents: number;
  description: string;
  resourceUrl: string;
  /** Stored on the Stripe PaymentIntent so every payment is traceable to what it bought. */
  metadata: Record<string, string>;
  /** Runs only after the payment settles. Its return value is the 200 body. */
  fulfill: (receipt: X402Receipt) => Promise<Record<string, unknown>>;
};

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function paymentRequired(
  server: x402ResourceServer,
  requirements: PaymentRequirements[],
  sale: X402Sale,
  error?: string,
) {
  return server
    .createPaymentRequiredResponse(
      requirements,
      {
        url: sale.resourceUrl,
        description: sale.description,
        mimeType: 'application/json',
        serviceName: 'AllMCPs',
      },
      error,
    )
    .then(
      (body) =>
        new NextResponse(JSON.stringify(body), {
          status: 402,
          headers: {
            ...NO_STORE,
            'Content-Type': 'application/json',
            'PAYMENT-REQUIRED': encodePaymentRequiredHeader(body),
            'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED',
          },
        }),
    );
}

/** Records a settled transfer as a Stripe PaymentIntent. Best-effort: the USDC is already ours. */
async function recordStripePayment(
  config: X402Config,
  settle: SettleResponse,
  amountCents: number,
  metadata: Record<string, string>,
): Promise<string | null> {
  if (!config.stripeSecretKey || amountCents < 1) return null;
  try {
    const stripe = getStripe(config.stripeSecretKey);
    const pi = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'usd',
        confirm: true,
        payment_method_data: { type: 'crypto' },
        allowed_payment_method_types: ['crypto'],
        payment_method_options: {
          crypto: {
            mode: 'transaction_verification',
            transaction_verification_options: {
              network: 'base',
              transaction_hash: settle.transaction,
            },
          },
        },
        metadata: { ...metadata, source: 'x402', payer: settle.payer ?? '' },
        // The machine-payments fields aren't in the stable SDK types yet.
      } as unknown as Parameters<typeof stripe.paymentIntents.create>[0],
      {
        idempotencyKey: `x402:${settle.transaction}`,
        apiVersion: STRIPE_MACHINE_PAYMENTS_API_VERSION,
      },
    );
    return pi.id;
  } catch (err) {
    console.error(
      `[x402] settled tx ${settle.transaction} but could not record it in Stripe:`,
      err,
    );
    return null;
  }
}

/**
 * Sells one thing over x402. Without a payment header it answers 402 with the
 * price; with one it verifies, settles, records the payment in Stripe, then
 * calls `fulfill`. Nothing is fulfilled unless settlement succeeds.
 */
export async function sellWithX402(
  req: Request,
  config: X402Config,
  sale: X402Sale,
): Promise<Response> {
  let server: x402ResourceServer;
  try {
    server = await getResourceServer(config);
  } catch (err) {
    console.error('[x402] facilitator unavailable:', err);
    return NextResponse.json(
      { error: 'x402 payments are temporarily unavailable. Try again soon.' },
      { status: 503, headers: NO_STORE },
    );
  }

  const requirements = await server.buildPaymentRequirementsFromOptions(
    [
      {
        scheme: 'exact',
        payTo: config.payTo,
        price: `$${(sale.priceCents / 100).toFixed(2)}`,
        network: config.network,
        maxTimeoutSeconds: 300,
      },
    ],
    {},
  );

  const header =
    req.headers.get('PAYMENT-SIGNATURE') ?? req.headers.get('X-PAYMENT');
  if (!header) return paymentRequired(server, requirements, sale);

  let payload: PaymentPayload;
  try {
    payload = decodePaymentSignatureHeader(header);
  } catch {
    return paymentRequired(
      server,
      requirements,
      sale,
      'Malformed PAYMENT-SIGNATURE header',
    );
  }

  const matched = server.findMatchingRequirements(requirements, payload);
  if (!matched) {
    return paymentRequired(
      server,
      requirements,
      sale,
      'Payment does not match the current price or network',
    );
  }

  const verified = await server.verifyPayment(payload, matched);
  if (!verified.isValid) {
    return paymentRequired(
      server,
      requirements,
      sale,
      verified.invalidReason || 'Payment verification failed',
    );
  }

  const settle = await server.settlePayment(payload, matched);
  if (!settle.success) {
    return paymentRequired(
      server,
      requirements,
      sale,
      settle.errorReason || 'Payment settlement failed',
    );
  }

  const amountCents = Math.round(Number(matched.amount) / USDC_ATOMIC_PER_CENT);
  const stripePaymentIntentId = await recordStripePayment(
    config,
    settle,
    amountCents,
    sale.metadata,
  );
  const receipt: X402Receipt = {
    transaction: settle.transaction,
    network: settle.network,
    payer: settle.payer ?? null,
    amountCents,
    stripePaymentIntentId,
  };

  const paymentResponse = {
    'PAYMENT-RESPONSE': encodePaymentResponseHeader(settle),
    'Access-Control-Expose-Headers': 'PAYMENT-RESPONSE',
  };

  try {
    const body = await sale.fulfill(receipt);
    return NextResponse.json(
      { success: true, payment: receipt, ...body },
      { status: 200, headers: { ...NO_STORE, ...paymentResponse } },
    );
  } catch (err) {
    // Paid but not delivered. Log loudly with the tx hash; the Stripe
    // PaymentIntent metadata says what was bought, so it can be fixed by hand.
    console.error(
      `[x402] PAID BUT NOT FULFILLED tx=${settle.transaction} metadata=${JSON.stringify(sale.metadata)}:`,
      err,
    );
    return NextResponse.json(
      {
        success: false,
        error:
          'Your payment settled but we could not activate the purchase. It has been logged; email support@allmcps.com with the transaction hash and we will fix it or refund you.',
        payment: receipt,
      },
      { status: 500, headers: { ...NO_STORE, ...paymentResponse } },
    );
  }
}
