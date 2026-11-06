import { and, eq, lt } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { acpIdempotencyKeys } from '@/db/schema';
import {
  type AgentIdentity,
  hasAgentScope,
  resolveAgentAuth,
  sha256Hex,
} from '@/lib/agentAuth';
import {
  AGENT_PROMO_CODE,
  agentPriceCents,
  isOneTimeBoostSku,
  type OneTimeBoostSku,
  PAID_PRODUCTS,
  tieredTotal,
  tieredUnitPrice,
} from '@/lib/pricing';

/**
 * Agentic Commerce Protocol (https://agenticcommerce.dev), seller side.
 * Agents buy listing boosts through the standard checkout_sessions API and pay
 * with a Stripe shared payment token (SPT) the buyer granted us.
 *
 * Products are addressed as `<sku>:<listing id>`, e.g. `featured_7d:acme-mcp`.
 * For weekly SKUs the quantity is the number of weeks.
 *
 * Off until ACP_MERCHANT_ID (our Stripe profile, which agents grant SPTs to)
 * and STRIPE_SECRET_KEY are set; until then /.well-known/acp.json is a 404.
 */

export const ACP_VERSION = '2026-04-17';
const SUPPORTED_VERSIONS = [ACP_VERSION];
const ACP_API_BASE = 'https://allmcps.com/api/acp';
export const ACP_HANDLER_ID = 'card_tokenized';
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 10;

type AcpConfig = {
  stripeSecretKey: string;
  merchantId: string;
  environment: 'production' | 'sandbox';
};

export function getAcpConfig(env: unknown): AcpConfig | null {
  const e = (env ?? {}) as Record<string, unknown>;
  const pick = (k: string) => {
    const v = e[k] ?? process.env[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const stripeSecretKey = pick('STRIPE_SECRET_KEY');
  const merchantId = pick('ACP_MERCHANT_ID');
  if (!stripeSecretKey || !merchantId) return null;
  return {
    stripeSecretKey,
    merchantId,
    environment: stripeSecretKey.startsWith('sk_live_')
      ? 'production'
      : 'sandbox',
  };
}

/** The /.well-known/acp.json discovery document (rfc.discovery). */
export function acpDiscovery() {
  return {
    protocol: {
      name: 'acp',
      version: ACP_VERSION,
      supported_versions: SUPPORTED_VERSIONS,
      documentation_url:
        'https://allmcps.com/.well-known/agent-skills/mcp-monetization/SKILL.md',
    },
    api_base_url: ACP_API_BASE,
    transports: ['rest'],
    capabilities: {
      services: ['checkout'],
      supported_currencies: ['usd'],
      supported_locales: ['en-US'],
    },
  };
}

// ---------------------------------------------------------------------------
// Protocol shapes

type AcpTotal = {
  type:
    | 'items_base_amount'
    | 'items_discount'
    | 'subtotal'
    | 'discount'
    | 'fulfillment'
    | 'tax'
    | 'total';
  display_text: string;
  amount: number;
};

export type AcpMessage =
  | { type: 'info'; content_type: 'plain'; content: string; param?: string }
  | {
      type: 'error';
      code:
        | 'missing'
        | 'invalid'
        | 'not_found'
        | 'conflict'
        | 'maximum_exceeded'
        | 'quantity_exceeded'
        | 'payment_declined'
        | 'expired'
        | 'unsupported';
      content_type: 'plain';
      content: string;
      param?: string;
    };

export type AcpError = {
  type: 'invalid_request' | 'processing_error' | 'service_unavailable';
  code: string;
  message: string;
  param?: string;
};

export type RequestedItem = { id: string; quantity: number };

/** `featured_7d:acme-mcp` → { sku, serverId }, or null for anything else. */
export function parseAcpItemId(
  id: string,
): { sku: OneTimeBoostSku; serverId: string } | null {
  const i = id.indexOf(':');
  if (i < 1) return null;
  const sku = id.slice(0, i);
  const serverId = id.slice(i + 1);
  if (!isOneTimeBoostSku(sku) || !serverId) return null;
  return { sku, serverId };
}

/**
 * Validates `line_items` (or the pre-2026 `items`) from a create/update body.
 * Returns the items, or an ACP error pointing at the bad field.
 */
export function parseRequestedItems(
  raw: unknown,
  field = 'line_items',
): RequestedItem[] | AcpError {
  if (!Array.isArray(raw) || raw.length === 0) {
    return invalid(
      'missing',
      `${field} must be a non-empty array`,
      `$.${field}`,
    );
  }
  if (raw.length > MAX_ITEMS) {
    return invalid(
      'invalid',
      `At most ${MAX_ITEMS} line items per checkout`,
      `$.${field}`,
    );
  }
  const items: RequestedItem[] = [];
  for (const [i, entry] of raw.entries()) {
    const e = (entry ?? {}) as Record<string, unknown>;
    if (typeof e.id !== 'string' || !e.id) {
      return invalid(
        'missing',
        'Each line item needs an id',
        `$.${field}[${i}].id`,
      );
    }
    const quantity = e.quantity === undefined ? 1 : Number(e.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return invalid(
        'invalid',
        'quantity must be a whole number of at least 1',
        `$.${field}[${i}].quantity`,
      );
    }
    items.push({ id: e.id, quantity });
  }
  return items;
}

function invalid(code: string, message: string, param?: string): AcpError {
  return {
    type: 'invalid_request',
    code,
    message,
    ...(param ? { param } : {}),
  };
}

/** A listing as far as pricing a line needs it. */
export type LineListing = { id: string; name: string };

export type PricedLine = {
  sku: OneTimeBoostSku;
  serverId: string;
  weeks: number;
  /** What the buyer pays for this line, in cents. */
  totalCents: number;
  lineItem: Record<string, unknown>;
};

const BASE = 'Base amount';
const AGENT_DISCOUNT = `Agent discount (${AGENT_PROMO_CODE}, 50% off)`;

/**
 * Prices one requested item. Returns the ACP LineItem plus what we need to
 * fulfil it, or an error message for the session's `messages`.
 */
export function priceLine(
  index: number,
  item: RequestedItem,
  listing: LineListing | null,
): PricedLine | AcpMessage {
  const param = `$.line_items[${index}]`;
  const parsed = parseAcpItemId(item.id);
  if (!parsed) {
    return errorMessage(
      'invalid',
      `Unknown item "${item.id}". Item ids are <sku>:<listing id>, with sku one of priority_review, featured_7d, category_sponsor_7d.`,
      `${param}.id`,
    );
  }
  if (!listing) {
    return errorMessage(
      'not_found',
      `No AllMCPs listing with id "${parsed.serverId}".`,
      `${param}.id`,
    );
  }
  const product = PAID_PRODUCTS[parsed.sku];
  const maxWeeks = product.weeklyTiers ? product.maxWeeks || 8 : 1;
  if (item.quantity > maxWeeks) {
    return errorMessage(
      product.weeklyTiers ? 'maximum_exceeded' : 'quantity_exceeded',
      product.weeklyTiers
        ? `${product.name} runs for at most ${maxWeeks} weeks per purchase (quantity is weeks).`
        : `${product.name} is bought once per listing; quantity must be 1.`,
      `${param}.quantity`,
    );
  }

  const weeks = item.quantity;
  const base = tieredTotal(product, weeks);
  const total = agentPriceCents(base);
  const discount = base - total;
  const span = product.weeklyTiers
    ? `${weeks} week${weeks === 1 ? '' : 's'}`
    : 'one-time';

  return {
    sku: parsed.sku,
    serverId: listing.id,
    weeks,
    totalCents: total,
    lineItem: {
      id: `li_${index + 1}`,
      item: { id: item.id },
      quantity: item.quantity,
      name: `${product.name}: ${listing.name}`,
      description: `${product.tagline} (${span}). ${product.placementHint}`,
      unit_amount: tieredUnitPrice(product, weeks),
      product_id: parsed.sku,
      sku: parsed.sku,
      totals: [
        { type: 'items_base_amount', display_text: BASE, amount: base },
        { type: 'discount', display_text: AGENT_DISCOUNT, amount: discount },
        { type: 'subtotal', display_text: 'Subtotal', amount: total },
        { type: 'tax', display_text: 'Tax', amount: 0 },
        { type: 'total', display_text: 'Total', amount: total },
      ] satisfies AcpTotal[],
    },
  };
}

export function errorMessage(
  code: Extract<AcpMessage, { type: 'error' }>['code'],
  content: string,
  param?: string,
): AcpMessage {
  return {
    type: 'error',
    code,
    content_type: 'plain',
    content,
    ...(param ? { param } : {}),
  };
}

export function isPricedLine(x: PricedLine | AcpMessage): x is PricedLine {
  return 'lineItem' in x;
}

/** Statuses a session can still be changed or paid from. */
export const OPEN_STATUSES = ['not_ready_for_payment', 'ready_for_payment'];

export type StoredSession = {
  id: string;
  status: string;
  buyer: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  stripePaymentIntentId: string | null;
};

/** The status an agent sees: open sessions are re-judged on every read. */
export function effectiveStatus(
  session: Pick<StoredSession, 'status' | 'expiresAt'>,
  hasErrors: boolean,
  now = Date.now(),
): string {
  if (!OPEN_STATUSES.includes(session.status)) return session.status;
  if (new Date(session.expiresAt).getTime() <= now) return 'expired';
  return hasErrors ? 'not_ready_for_payment' : 'ready_for_payment';
}

export function sessionExpiry(now = Date.now()): Date {
  return new Date(now + SESSION_TTL_MS);
}

/** Builds the CheckoutSession response body. */
export function serializeSession(opts: {
  session: StoredSession;
  status: string;
  lines: PricedLine[];
  messages: AcpMessage[];
  config: AcpConfig;
  order?: Record<string, unknown>;
}) {
  const { session, lines, config } = opts;
  const base = lines.reduce(
    (sum, l) =>
      sum +
      ((l.lineItem.totals as AcpTotal[]).find(
        (t) => t.type === 'items_base_amount',
      )?.amount ?? 0),
    0,
  );
  const total = lines.reduce((sum, l) => sum + l.totalCents, 0);
  const buyer = parseJson(session.buyer);

  return {
    id: session.id,
    protocol: { version: ACP_VERSION },
    capabilities: {
      payment: {
        handlers: [
          {
            id: ACP_HANDLER_ID,
            name: 'dev.acp.tokenized.card',
            display_name: 'Card',
            version: '2026-01-22',
            spec: 'https://acp.dev/handlers/tokenized.card',
            requires_delegate_payment: true,
            requires_pci_compliance: false,
            psp: 'stripe',
            config_schema:
              'https://acp.dev/schemas/handlers/tokenized.card/config.json',
            instrument_schemas: [
              'https://acp.dev/schemas/handlers/tokenized.card/instrument.json',
            ],
            config: {
              merchant_id: config.merchantId,
              psp: 'stripe',
              environment: config.environment,
              supports_3ds: false,
            },
          },
        ],
      },
      interventions: { supported: [], required: [], enforcement: 'optional' },
    },
    ...(buyer ? { buyer } : {}),
    status: opts.status,
    currency: 'usd',
    line_items: lines.map((l) => l.lineItem),
    fulfillment_options: [
      {
        type: 'digital',
        id: 'instant',
        title: 'Activates on payment',
        description:
          'Featured and category-sponsor placement starts as soon as payment succeeds; priority review moves the listing to the front of the queue.',
        totals: [{ type: 'total', display_text: 'Delivery', amount: 0 }],
      },
    ],
    ...(lines.length
      ? {
          selected_fulfillment_options: [
            {
              type: 'digital',
              option_id: 'instant',
              item_ids: lines.map(
                (l) => (l.lineItem.item as { id: string }).id,
              ),
            },
          ],
        }
      : {}),
    totals: [
      { type: 'items_base_amount', display_text: 'Items', amount: base },
      { type: 'discount', display_text: AGENT_DISCOUNT, amount: base - total },
      { type: 'subtotal', display_text: 'Subtotal', amount: total },
      { type: 'tax', display_text: 'Tax', amount: 0 },
      { type: 'total', display_text: 'Total', amount: total },
    ] satisfies AcpTotal[],
    messages: opts.messages,
    links: [
      { type: 'terms_of_use', url: 'https://allmcps.com/terms' },
      { type: 'privacy_policy', url: 'https://allmcps.com/privacy' },
      { type: 'support', url: 'https://allmcps.com/contact' },
    ],
    created_at: new Date(session.createdAt).toISOString(),
    updated_at: new Date(session.updatedAt).toISOString(),
    expires_at: new Date(session.expiresAt).toISOString(),
    ...(opts.order ? { order: opts.order } : {}),
  };
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Keeps the ACP Buyer fields we use; email is required by the schema. */
export function parseBuyer(
  raw: unknown,
):
  | { ok: true; buyer: Record<string, string> | null }
  | { ok: false; error: AcpError } {
  if (raw === undefined || raw === null) return { ok: true, buyer: null };
  const b = raw as Record<string, unknown>;
  if (typeof b.email !== 'string' || !b.email.includes('@')) {
    return {
      ok: false,
      error: invalid(
        'invalid',
        'buyer.email must be an email address',
        '$.buyer.email',
      ),
    };
  }
  const buyer: Record<string, string> = { email: b.email.trim().toLowerCase() };
  for (const k of ['first_name', 'last_name', 'full_name', 'phone_number']) {
    const v = b[k];
    if (typeof v === 'string' && v) buyer[k] = v.slice(0, 200);
  }
  return { ok: true, buyer };
}

// ---------------------------------------------------------------------------
// HTTP layer: headers, auth and idempotency, per the agentic checkout RFC.

export type AcpResult = { status: number; body: unknown };

export function acpError(status: number, error: AcpError): AcpResult {
  return { status, body: error };
}

/** API-Version and Idempotency-Key checks; null when the request may proceed. */
export function checkAcpHeaders(
  headers: Headers,
  method: string,
): AcpResult | null {
  const version = headers.get('API-Version');
  if (!version) {
    return acpError(400, {
      ...invalid('missing_api_version', 'The API-Version header is required.'),
    });
  }
  if (!SUPPORTED_VERSIONS.includes(version)) {
    return {
      status: 400,
      body: {
        ...invalid(
          'unsupported_api_version',
          `API-Version ${version} is not supported. Use ${ACP_VERSION}.`,
        ),
        supported_versions: SUPPORTED_VERSIONS,
      },
    };
  }
  if (method === 'POST') {
    const key = headers.get('Idempotency-Key');
    if (!key) {
      return acpError(
        400,
        invalid(
          'idempotency_key_required',
          'Idempotency-Key header is required for POST requests.',
        ),
      );
    }
    if (key.length > 255) {
      return acpError(
        400,
        invalid('invalid', 'Idempotency-Key must be at most 255 characters.'),
      );
    }
  }
  return null;
}

type Handler = (ctx: {
  agent: AgentIdentity;
  body: Record<string, unknown>;
}) => Promise<AcpResult>;

/**
 * Wraps one ACP endpoint: config, API version, bearer auth (an AllMCPs agent
 * token with the checkout:write scope), Idempotency-Key replay for POSTs, and
 * the echoed response headers.
 */
export async function handleAcp(
  req: Request,
  deps: { env: unknown; db: DrizzleD1Database },
  run: Handler,
): Promise<Response> {
  const echo: Record<string, string> = {};
  const requestId = req.headers.get('Request-Id');
  if (requestId) echo['Request-Id'] = requestId.slice(0, 255);
  const idemKey = req.headers.get('Idempotency-Key');
  if (req.method === 'POST' && idemKey) echo['Idempotency-Key'] = idemKey;
  const respond = (r: AcpResult, extra: Record<string, string> = {}) =>
    Response.json(r.body, {
      status: r.status,
      headers: { 'Cache-Control': 'no-store', ...echo, ...extra },
    });

  if (!getAcpConfig(deps.env)) {
    return respond(
      acpError(503, {
        type: 'service_unavailable',
        code: 'not_enabled',
        message:
          'ACP checkout is not enabled. Use POST /api/v1/boost/checkout or /api/v1/boost/x402.',
      }),
    );
  }

  const headerError = checkAcpHeaders(req.headers, req.method);
  if (headerError) return respond(headerError);

  const agent = await resolveAgentAuth(
    deps.db,
    req.headers.get('Authorization'),
  );
  if (!agent) {
    return respond(
      acpError(401, {
        ...invalid(
          'unauthorized',
          'Send Authorization: Bearer <AllMCPs agent token>. Get one with POST /api/v1/agent/register (scopes: ["checkout:write"]) and /api/v1/agent/register/confirm.',
        ),
      }),
      { 'WWW-Authenticate': 'Bearer' },
    );
  }
  if (!hasAgentScope(agent, 'checkout:write')) {
    return respond(
      acpError(403, {
        ...invalid(
          'insufficient_scope',
          'This agent token lacks the checkout:write scope. Register a new token requesting it.',
        ),
      }),
    );
  }

  const raw = req.method === 'POST' ? await req.text() : '';
  let body: Record<string, unknown> = {};
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed;
      } else throw new Error('not an object');
    } catch {
      return respond(
        acpError(
          400,
          invalid('invalid', 'Request body must be a JSON object.'),
        ),
      );
    }
  }

  if (req.method !== 'POST' || !idemKey) {
    return respond(await runSafely(run, { agent, body }));
  }

  // Idempotency: the first request with a key claims it; replays get the
  // stored answer, a different body under the same key is a conflict.
  const db = deps.db;
  const requestHash = await sha256Hex(
    `${req.method} ${new URL(req.url).pathname}\n${raw}`,
  );
  const where = and(
    eq(acpIdempotencyKeys.agentTokenHash, agent.tokenHash),
    eq(acpIdempotencyKeys.key, idemKey),
  );
  const claimed = await db
    .insert(acpIdempotencyKeys)
    .values({
      agentTokenHash: agent.tokenHash,
      key: idemKey,
      requestHash,
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ key: acpIdempotencyKeys.key });

  if (claimed.length === 0) {
    const [prior] = await db
      .select()
      .from(acpIdempotencyKeys)
      .where(where)
      .limit(1);
    if (prior && prior.requestHash !== requestHash) {
      return respond(
        acpError(
          422,
          invalid(
            'idempotency_conflict',
            'This Idempotency-Key was already used with a different request.',
          ),
        ),
      );
    }
    if (!prior || prior.responseStatus === null) {
      return respond(
        acpError(
          409,
          invalid(
            'idempotency_in_flight',
            'A request with this Idempotency-Key is still being processed.',
          ),
        ),
        { 'Retry-After': '2' },
      );
    }
    return respond(
      {
        status: prior.responseStatus,
        body: parseJson(prior.responseBody),
      },
      { 'Idempotent-Replayed': 'true' },
    );
  }

  const result = await runSafely(run, { agent, body });
  if (result.status >= 500) {
    // Let the agent retry a failure with the same key.
    await db.delete(acpIdempotencyKeys).where(where);
  } else {
    await db
      .update(acpIdempotencyKeys)
      .set({
        responseStatus: result.status,
        responseBody: JSON.stringify(result.body),
      })
      .where(where);
  }
  // Housekeeping: drop keys past the 24h replay window now and then.
  if (Math.random() < 0.05) {
    await db
      .delete(acpIdempotencyKeys)
      .where(
        lt(
          acpIdempotencyKeys.createdAt,
          new Date(Date.now() - IDEMPOTENCY_TTL_MS),
        ),
      )
      .catch(() => {});
  }
  return respond(result);
}

async function runSafely(
  run: Handler,
  ctx: Parameters<Handler>[0],
): Promise<AcpResult> {
  try {
    return await run(ctx);
  } catch (err) {
    console.error('[acp] handler failed:', err);
    return acpError(500, {
      type: 'processing_error',
      code: 'internal_error',
      message:
        'Something went wrong on our side. Retry with the same Idempotency-Key.',
    });
  }
}
