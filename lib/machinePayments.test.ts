import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMachinePaymentConfig,
  sellWithMachinePayments,
} from './machinePayments';

// Fictional deposit address; never a real wallet.
const PAY_TO = '0x00000000000000000000000000000000000a11ce';
const SEPOLIA = 'eip155:84532';
const MPP = {
  MPP_SECRET_KEY: 'test-mpp-secret-key-for-challenges-only',
  STRIPE_PROFILE_ID: 'profile_test_123',
  STRIPE_SECRET_KEY: 'sk_test_fake',
};
let n = 0;
const x402Env = () => {
  n += 1;
  return {
    X402_PAY_TO: PAY_TO,
    X402_NETWORK: SEPOLIA,
    X402_FACILITATOR_URL: `https://mp-facilitator${n}.example/x402`,
  };
};

const fulfill = vi.fn(async () => ({ activated: true }));
const sale = {
  priceCents: 1250,
  description: 'Featured listing',
  resourceUrl: 'https://allmcps.com/api/v1/boost/x402',
  metadata: { serverId: 'acme-mcp' },
  discovery: {
    bodyType: 'json' as const,
    input: { serverId: 'acme-mcp' },
    inputSchema: { type: 'object', properties: {} },
  },
  fulfill,
};
function configFor(env: Record<string, string>) {
  const config = getMachinePaymentConfig(env);
  if (!config) throw new Error('expected a payment config');
  return config;
}
const unpaid = () =>
  new Request(sale.resourceUrl, { method: 'POST', body: '{}' });

describe('machine payments', () => {
  beforeEach(() => {
    for (const k of [
      'X402_PAY_TO',
      'MPP_SECRET_KEY',
      'STRIPE_PROFILE_ID',
      'STRIPE_SECRET_KEY',
    ])
      vi.stubEnv(k, '');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (!String(url).includes('facilitator')) {
          throw new Error(`unexpected network call: ${url}`);
        }
        return Response.json({
          kinds: [{ x402Version: 2, scheme: 'exact', network: SEPOLIA }],
        });
      }),
    );
    fulfill.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('is off when neither protocol is configured', () => {
    expect(getMachinePaymentConfig({})).toBeNull();
    expect(
      getMachinePaymentConfig({ MPP_SECRET_KEY: 'x', STRIPE_SECRET_KEY: 'y' }),
    ).toBeNull();
  });

  it('answers an unpaid request with an MPP Stripe challenge when only MPP is on', async () => {
    const config = configFor(MPP);
    expect(config.mpp).toBeTruthy();
    expect(config.x402).toBeNull();
    const res = await sellWithMachinePayments(unpaid(), config, sale);
    expect(res.status).toBe(402);
    const auth = res.headers.get('www-authenticate') ?? '';
    expect(auth).toMatch(/^Payment /);
    expect(auth).toContain('method="stripe"');
    expect(auth).toContain('intent="charge"');
    expect(fulfill).not.toHaveBeenCalled();
  });

  it('offers both x402 and MPP in one 402 when both are on', async () => {
    const config = configFor({ ...x402Env(), ...MPP });
    const res = await sellWithMachinePayments(unpaid(), config, sale);
    expect(res.status).toBe(402);
    expect(res.headers.get('payment-required')).toBeTruthy();
    expect(res.headers.get('www-authenticate')).toContain('method="stripe"');
    expect(res.headers.get('access-control-expose-headers')).toContain(
      'WWW-Authenticate',
    );
    const body = (await res.json()) as { x402Version: number };
    expect(body.x402Version).toBe(2);
    expect(fulfill).not.toHaveBeenCalled();
  });

  it('rejects a bogus MPP credential without fulfilling', async () => {
    const config = configFor(MPP);
    const res = await sellWithMachinePayments(
      new Request(sale.resourceUrl, {
        method: 'POST',
        headers: { Authorization: 'Payment not-a-real-credential' },
      }),
      config,
      sale,
    );
    expect(res.status).toBe(402);
    expect(fulfill).not.toHaveBeenCalled();
  });
});
