import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import type { PaymentRequired } from '@x402/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getX402Config, sellWithX402, x402Status } from './x402';

// Fictional deposit address; never a real wallet.
const PAY_TO = '0x00000000000000000000000000000000000a11ce';
const SEPOLIA = 'eip155:84532';

describe('getX402Config', () => {
  beforeEach(() => {
    for (const k of [
      'X402_PAY_TO',
      'X402_NETWORK',
      'X402_FACILITATOR_URL',
      'CDP_API_KEY_ID',
      'CDP_API_KEY_SECRET',
    ])
      vi.stubEnv(k, '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('is off without a deposit address, so nothing advertises x402', () => {
    expect(getX402Config({})).toBeNull();
    expect(x402Status({})).toEqual({ enabled: false });
  });

  it('rejects a malformed address or an unsupported network', () => {
    expect(getX402Config({ X402_PAY_TO: 'not-an-address' })).toBeNull();
    expect(
      getX402Config({ X402_PAY_TO: PAY_TO, X402_NETWORK: 'eip155:1' }),
    ).toBeNull();
  });

  it('needs CDP keys for mainnet', () => {
    expect(getX402Config({ X402_PAY_TO: PAY_TO })).toBeNull();
    const config = getX402Config({
      X402_PAY_TO: PAY_TO,
      CDP_API_KEY_ID: 'id',
      CDP_API_KEY_SECRET: 'secret',
    });
    expect(config?.network).toBe('eip155:8453');
    expect(config?.facilitator.url).toContain('api.cdp.coinbase.com');
  });

  it('uses the public test facilitator on Base Sepolia', () => {
    const config = getX402Config({
      X402_PAY_TO: PAY_TO.toUpperCase().replace('0X', '0x'),
      X402_NETWORK: SEPOLIA,
    });
    expect(config?.payTo).toBe(PAY_TO);
    expect(config?.facilitator.url).toBe('https://x402.org/facilitator');
    expect(
      x402Status({ X402_PAY_TO: PAY_TO, X402_NETWORK: SEPOLIA }),
    ).toMatchObject({ enabled: true, network: SEPOLIA, asset: 'USDC' });
  });
});

describe('sellWithX402', () => {
  let verifyResult: Record<string, unknown>;
  let settleResult: Record<string, unknown>;
  const calls: string[] = [];
  let n = 0;

  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    calls.length = 0;
    verifyResult = { isValid: true, payer: '0xb0b' };
    settleResult = {
      success: true,
      transaction: '0xfeed',
      network: SEPOLIA,
      payer: '0xb0b',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname.split('/').pop() as string;
        calls.push(path);
        const body =
          path === 'supported'
            ? { kinds: [{ x402Version: 2, scheme: 'exact', network: SEPOLIA }] }
            : path === 'verify'
              ? verifyResult
              : settleResult;
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // A fresh facilitator URL per test, so the per-isolate server cache doesn't leak.
  function setup() {
    n += 1;
    const config = getX402Config({
      X402_PAY_TO: PAY_TO,
      X402_NETWORK: SEPOLIA,
      X402_FACILITATOR_URL: `https://facilitator${n}.example/x402`,
    });
    if (!config) throw new Error('config');
    const fulfill = vi.fn(async () => ({ activated: true }));
    const sale = {
      priceCents: 50,
      description: 'Featured listing',
      resourceUrl: 'https://allmcps.com/api/v1/boost/x402',
      metadata: { serverId: 'acme-mcp' },
      fulfill,
    };
    const req = (headers: Record<string, string> = {}) =>
      new Request(sale.resourceUrl, { method: 'POST', headers });
    return { config, sale, fulfill, req };
  }

  async function challenge(config: ReturnType<typeof setup>) {
    const res = await sellWithX402(config.req(), config.config, config.sale);
    expect(res.status).toBe(402);
    const header = res.headers.get('PAYMENT-REQUIRED');
    expect(header).toBeTruthy();
    return decodePaymentRequiredHeader(header as string) as PaymentRequired;
  }

  function signed(required: PaymentRequired) {
    return encodePaymentSignatureHeader({
      x402Version: 2,
      accepted: required.accepts[0],
      payload: { signature: '0xsig', authorization: {} },
    });
  }

  it('answers an unpaid request with a 402 challenge for the exact price', async () => {
    const s = setup();
    const required = await challenge(s);
    expect(required.x402Version).toBe(2);
    expect(required.accepts[0]).toMatchObject({
      scheme: 'exact',
      network: SEPOLIA,
      payTo: PAY_TO,
      amount: '500000', // $0.50 in 6-decimal USDC
    });
    expect(s.fulfill).not.toHaveBeenCalled();
  });

  it('fulfills only after the payment verifies and settles', async () => {
    const s = setup();
    const required = await challenge(s);
    const res = await sellWithX402(
      s.req({ 'PAYMENT-SIGNATURE': signed(required) }),
      s.config,
      s.sale,
    );

    expect(res.status).toBe(200);
    expect(calls).toEqual(['supported', 'verify', 'settle']);
    expect(s.fulfill).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: '0xfeed', amountCents: 50 }),
    );
    const receipt = decodePaymentResponseHeader(
      res.headers.get('PAYMENT-RESPONSE') as string,
    );
    expect(receipt.transaction).toBe('0xfeed');
    expect(await res.json()).toMatchObject({ success: true, activated: true });
  });

  it('does not settle or fulfill a payment that fails verification', async () => {
    const s = setup();
    const required = await challenge(s);
    verifyResult = { isValid: false, invalidReason: 'insufficient_funds' };
    const res = await sellWithX402(
      s.req({ 'PAYMENT-SIGNATURE': signed(required) }),
      s.config,
      s.sale,
    );

    expect(res.status).toBe(402);
    expect(calls).not.toContain('settle');
    expect(s.fulfill).not.toHaveBeenCalled();
  });

  it('does not fulfill when settlement fails', async () => {
    const s = setup();
    const required = await challenge(s);
    settleResult = {
      success: false,
      errorReason: 'nonce_reused',
      transaction: '',
      network: SEPOLIA,
    };
    const res = await sellWithX402(
      s.req({ 'PAYMENT-SIGNATURE': signed(required) }),
      s.config,
      s.sale,
    );

    expect(res.status).toBe(402);
    expect(s.fulfill).not.toHaveBeenCalled();
  });

  it('rejects a payment signed for a different price', async () => {
    const s = setup();
    const required = await challenge(s);
    required.accepts[0] = { ...required.accepts[0], amount: '1' };
    const res = await sellWithX402(
      s.req({ 'PAYMENT-SIGNATURE': signed(required) }),
      s.config,
      s.sale,
    );

    expect(res.status).toBe(402);
    expect(calls).not.toContain('verify');
    expect(s.fulfill).not.toHaveBeenCalled();
  });
});
