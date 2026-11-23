import { getMppConfig, hasMppCredential, sellWithMpp } from '@/lib/mpp';
import { getX402Config, sellWithX402, type X402Sale } from '@/lib/x402';

/**
 * One paid endpoint, two agent payment protocols. An unpaid request gets a
 * single 402 that carries both challenges (x402's PAYMENT-REQUIRED header and
 * MPP's WWW-Authenticate: Payment), and a paid retry goes to whichever
 * protocol the agent answered with. Each protocol is offered only when it is
 * configured.
 */

type MachinePaymentConfig = {
  x402: ReturnType<typeof getX402Config>;
  mpp: ReturnType<typeof getMppConfig>;
};

type MachineReceipt = {
  protocol: 'x402' | 'mpp';
  /** Stored with the order: `x402:<tx hash>` or `mpp:<PaymentIntent id>`. */
  paymentRef: string;
  amountCents: number;
  stripePaymentIntentId: string | null;
  /** Short label for receipts, e.g. "USDC via x402". */
  paidWith: string;
};

type MachineSale = Omit<X402Sale, 'fulfill'> & {
  fulfill: (receipt: MachineReceipt) => Promise<Record<string, unknown>>;
};

/** Null when neither protocol is configured. */
export function getMachinePaymentConfig(
  env: unknown,
): MachinePaymentConfig | null {
  const config = { x402: getX402Config(env), mpp: getMppConfig(env) };
  return config.x402 || config.mpp ? config : null;
}

function hasX402Payment(req: Request): boolean {
  return Boolean(
    req.headers.get('PAYMENT-SIGNATURE') ?? req.headers.get('X-PAYMENT'),
  );
}

export async function sellWithMachinePayments(
  req: Request,
  config: MachinePaymentConfig,
  sale: MachineSale,
): Promise<Response> {
  const mppSale = () => ({
    priceCents: sale.priceCents,
    description: sale.description,
    fulfill: ({
      reference,
      amountCents,
    }: {
      reference: string;
      amountCents: number;
    }) =>
      sale.fulfill({
        protocol: 'mpp',
        paymentRef: `mpp:${reference}`,
        amountCents,
        stripePaymentIntentId: reference.startsWith('pi_') ? reference : null,
        paidWith: 'card via MPP',
      }),
  });
  const x402Sale = (): X402Sale => ({
    ...sale,
    fulfill: (r) =>
      sale.fulfill({
        protocol: 'x402',
        paymentRef: `x402:${r.transaction}`,
        amountCents: r.amountCents,
        stripePaymentIntentId: r.stripePaymentIntentId,
        paidWith: 'USDC via x402',
      }),
  });

  if (config.mpp && hasMppCredential(req)) {
    return sellWithMpp(req, config.mpp, mppSale());
  }
  if (config.x402 && hasX402Payment(req)) {
    return sellWithX402(req, config.x402, x402Sale());
  }

  // Unpaid: offer every configured protocol in one 402.
  const x402Res = config.x402
    ? await sellWithX402(req, config.x402, x402Sale())
    : null;
  if (!config.mpp) return x402Res as Response;
  const mppRes = await sellWithMpp(req, config.mpp, mppSale());
  if (x402Res?.status !== 402) return mppRes;
  if (mppRes.status !== 402) return x402Res;

  const headers = new Headers(x402Res.headers);
  for (const [k, v] of mppRes.headers) {
    if (k.toLowerCase() === 'www-authenticate') headers.append(k, v);
  }
  headers.set(
    'Access-Control-Expose-Headers',
    'PAYMENT-REQUIRED, WWW-Authenticate',
  );
  return new Response(x402Res.body, { status: 402, headers });
}
