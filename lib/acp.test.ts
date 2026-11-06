import { describe, expect, it } from 'vitest';
import {
  ACP_VERSION,
  acpDiscovery,
  checkAcpHeaders,
  effectiveStatus,
  getAcpConfig,
  handleAcp,
  isPricedLine,
  parseAcpItemId,
  parseBuyer,
  parseRequestedItems,
  priceLine,
  serializeSession,
} from './acp';

const ENV = {
  STRIPE_SECRET_KEY: 'sk_test_acme',
  ACP_MERCHANT_ID: 'profile_acme',
};
const LISTING = { id: 'acme-mcp', name: 'Acme MCP' };

describe('getAcpConfig', () => {
  it('is off without a merchant id, and knows test keys are sandbox', () => {
    expect(
      getAcpConfig({ STRIPE_SECRET_KEY: 'sk_test_acme', ACP_MERCHANT_ID: '' }),
    ).toBeNull();
    expect(getAcpConfig(ENV)).toMatchObject({
      merchantId: 'profile_acme',
      environment: 'sandbox',
    });
  });
});

describe('acpDiscovery', () => {
  it('matches the rfc.discovery required fields', () => {
    const doc = acpDiscovery();
    expect(doc.protocol).toMatchObject({
      name: 'acp',
      version: ACP_VERSION,
      supported_versions: [ACP_VERSION],
    });
    expect(doc.api_base_url).toBe('https://allmcps.com/api/acp');
    expect(doc.transports).toEqual(['rest']);
    expect(doc.capabilities.services).toEqual(['checkout']);
  });
});

describe('items', () => {
  it('parses <sku>:<listing id> and rejects anything else', () => {
    expect(parseAcpItemId('featured_7d:acme-mcp')).toEqual({
      sku: 'featured_7d',
      serverId: 'acme-mcp',
    });
    expect(parseAcpItemId('premium_monthly:acme-mcp')).toBeNull();
    expect(parseAcpItemId('acme-mcp')).toBeNull();
  });

  it('validates line_items and defaults quantity to 1', () => {
    expect(parseRequestedItems([{ id: 'featured_7d:acme-mcp' }])).toEqual([
      { id: 'featured_7d:acme-mcp', quantity: 1 },
    ]);
    expect(parseRequestedItems([])).toMatchObject({ code: 'missing' });
    expect(
      parseRequestedItems([{ id: 'featured_7d:acme-mcp', quantity: 0 }]),
    ).toMatchObject({ param: '$.line_items[0].quantity' });
  });

  it('prices weeks with the volume tier and the 50% agent discount', () => {
    const line = priceLine(
      0,
      { id: 'featured_7d:acme-mcp', quantity: 2 },
      LISTING,
    );
    if (!isPricedLine(line)) throw new Error(line.content);
    // 2 weeks at the 2-3 week tier ($10.80/wk) = $21.60 list, $10.80 to agents.
    expect(line.totalCents).toBe(1080);
    expect(line.weeks).toBe(2);
    expect(line.lineItem).toMatchObject({ quantity: 2, unit_amount: 1080 });
    const totals = line.lineItem.totals as { type: string; amount: number }[];
    expect(totals.find((t) => t.type === 'items_base_amount')?.amount).toBe(
      2160,
    );
    expect(totals.find((t) => t.type === 'total')?.amount).toBe(1080);
  });

  it('explains unknown items, missing listings and too many weeks', () => {
    expect(priceLine(0, { id: 'nope', quantity: 1 }, null)).toMatchObject({
      type: 'error',
      code: 'invalid',
    });
    expect(
      priceLine(0, { id: 'featured_7d:ghost', quantity: 1 }, null),
    ).toMatchObject({ code: 'not_found' });
    expect(
      priceLine(0, { id: 'featured_7d:acme-mcp', quantity: 9 }, LISTING),
    ).toMatchObject({ code: 'maximum_exceeded' });
    expect(
      priceLine(0, { id: 'priority_review:acme-mcp', quantity: 2 }, LISTING),
    ).toMatchObject({ code: 'quantity_exceeded' });
  });

  it('requires a buyer email when a buyer is given', () => {
    expect(parseBuyer(undefined)).toEqual({ ok: true, buyer: null });
    expect(parseBuyer({ first_name: 'Ada' })).toMatchObject({ ok: false });
    expect(parseBuyer({ email: 'Ada@Acme.example' })).toEqual({
      ok: true,
      buyer: { email: 'ada@acme.example' },
    });
  });
});

describe('sessions', () => {
  const now = Date.now();
  const session = {
    id: 'cs_1',
    status: 'not_ready_for_payment',
    buyer: null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    expiresAt: new Date(now + 60_000),
    stripePaymentIntentId: null,
  };

  it('re-judges open sessions and expires stale ones', () => {
    expect(effectiveStatus(session, false, now)).toBe('ready_for_payment');
    expect(effectiveStatus(session, true, now)).toBe('not_ready_for_payment');
    expect(effectiveStatus(session, false, now + 120_000)).toBe('expired');
    expect(
      effectiveStatus(
        { ...session, status: 'completed' },
        false,
        now + 120_000,
      ),
    ).toBe('completed');
  });

  it('serializes the required CheckoutSession fields and a Stripe SPT handler', () => {
    const line = priceLine(
      0,
      { id: 'featured_7d:acme-mcp', quantity: 1 },
      LISTING,
    );
    if (!isPricedLine(line)) throw new Error('unpriced');
    const config = getAcpConfig(ENV);
    if (!config) throw new Error('config');
    const body = serializeSession({
      session,
      status: 'ready_for_payment',
      lines: [line],
      messages: [],
      config,
    });
    for (const k of [
      'id',
      'status',
      'currency',
      'line_items',
      'totals',
      'fulfillment_options',
      'messages',
      'links',
      'capabilities',
    ]) {
      expect(body).toHaveProperty(k);
    }
    expect(body.protocol.version).toBe(ACP_VERSION);
    expect(body.totals.at(-1)).toEqual({
      type: 'total',
      display_text: 'Total',
      amount: 600,
    });
    expect(body.capabilities.payment.handlers[0]).toMatchObject({
      id: 'card_tokenized',
      psp: 'stripe',
      requires_delegate_payment: true,
      config: { merchant_id: 'profile_acme' },
    });
  });
});

describe('HTTP layer', () => {
  const headers = (h: Record<string, string>) => new Headers(h);

  it('requires a supported API-Version, and an Idempotency-Key on POST', () => {
    expect(checkAcpHeaders(headers({}), 'GET')?.body).toMatchObject({
      code: 'missing_api_version',
    });
    expect(
      checkAcpHeaders(headers({ 'API-Version': '2025-09-29' }), 'GET')?.body,
    ).toMatchObject({
      code: 'unsupported_api_version',
      supported_versions: [ACP_VERSION],
    });
    expect(
      checkAcpHeaders(headers({ 'API-Version': ACP_VERSION }), 'POST')?.body,
    ).toMatchObject({ code: 'idempotency_key_required' });
    expect(
      checkAcpHeaders(
        headers({ 'API-Version': ACP_VERSION, 'Idempotency-Key': 'k1' }),
        'POST',
      ),
    ).toBeNull();
  });

  it('answers 503 while ACP is not configured, echoing Request-Id', async () => {
    const res = await handleAcp(
      new Request('https://allmcps.com/api/acp/checkout_sessions', {
        method: 'POST',
        headers: { 'Request-Id': 'req_1', 'Idempotency-Key': 'k1' },
      }),
      { env: { STRIPE_SECRET_KEY: '', ACP_MERCHANT_ID: '' }, db: {} as never },
      async () => ({ status: 200, body: {} }),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('Request-Id')).toBe('req_1');
    expect(res.headers.get('Idempotency-Key')).toBe('k1');
    expect(await res.json()).toMatchObject({ type: 'service_unavailable' });
  });
});
