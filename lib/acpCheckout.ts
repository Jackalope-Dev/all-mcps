import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { acpCheckoutSessions, servers } from '@/db/schema';
import {
  ACP_HANDLER_ID,
  type AcpMessage,
  type AcpResult,
  acpError,
  effectiveStatus,
  errorMessage,
  getAcpConfig,
  isPricedLine,
  OPEN_STATUSES,
  type PricedLine,
  parseAcpItemId,
  parseBuyer,
  parseRequestedItems,
  priceLine,
  type RequestedItem,
  type StoredSession,
  serializeSession,
  sessionExpiry,
} from '@/lib/acp';
import type { AgentIdentity } from '@/lib/agentAuth';
import {
  boostEligibilityError,
  fulfillBoostPurchase,
} from '@/lib/boostPurchase';
import { getStripe } from '@/lib/stripe';

/** Shared payment tokens need a preview API version (docs.stripe.com/agentic-commerce). */
const STRIPE_SPT_API_VERSION = '2026-09-30.preview';

type Ctx = {
  db: DrizzleD1Database;
  env: unknown;
  agent: AgentIdentity;
  body: Record<string, unknown>;
};

type SessionRow = typeof acpCheckoutSessions.$inferSelect;

const notFound = () =>
  acpError(404, {
    type: 'invalid_request',
    code: 'not_found',
    message: 'No checkout session with that id.',
  });

function config(env: unknown) {
  const c = getAcpConfig(env);
  if (!c) throw new Error('ACP is not configured');
  return c;
}

/** Prices every item against the live catalog and eligibility rules. */
async function priceItems(
  db: DrizzleD1Database,
  items: RequestedItem[],
  /** Off for finished sessions: a boost we just sold must not read as ineligible. */
  checkEligibility = true,
): Promise<{ lines: PricedLine[]; messages: AcpMessage[] }> {
  const ids = [
    ...new Set(
      items
        .map((i) => parseAcpItemId(i.id)?.serverId)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const rows = ids.length
    ? await db.select().from(servers).where(inArray(servers.id, ids))
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const lines: PricedLine[] = [];
  const messages: AcpMessage[] = [];
  const seen = new Set<string>();
  for (const [i, item] of items.entries()) {
    const parsed = parseAcpItemId(item.id);
    const row = parsed ? (byId.get(parsed.serverId) ?? null) : null;
    const priced = priceLine(i, item, row);
    if (!isPricedLine(priced)) {
      messages.push(priced);
      continue;
    }
    if (seen.has(item.id)) {
      messages.push(
        errorMessage(
          'conflict',
          `"${item.id}" appears twice; buy more weeks with quantity instead.`,
          `$.line_items[${i}].id`,
        ),
      );
      continue;
    }
    seen.add(item.id);
    const ineligible =
      row && checkEligibility
        ? await boostEligibilityError(db, row, priced.sku)
        : null;
    if (ineligible) {
      messages.push(
        errorMessage(
          ineligible.status === 409 ? 'conflict' : 'unsupported',
          ineligible.error,
          `$.line_items[${i}]`,
        ),
      );
      continue;
    }
    lines.push(priced);
  }
  return { lines, messages };
}

function storedItems(row: SessionRow): RequestedItem[] {
  try {
    const parsed = JSON.parse(row.items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function render(
  ctx: Ctx,
  row: SessionRow,
  extra: { messages?: AcpMessage[]; order?: Record<string, unknown> } = {},
): Promise<Record<string, unknown>> {
  const { lines, messages } = await priceItems(
    ctx.db,
    storedItems(row),
    OPEN_STATUSES.includes(row.status),
  );
  const all = [...messages, ...(extra.messages ?? [])];
  const status = effectiveStatus(row, messages.length > 0);
  if (status === 'expired') {
    all.push(
      errorMessage(
        'expired',
        'This checkout session expired. Start a new one.',
      ),
    );
  }
  return serializeSession({
    session: row as StoredSession,
    status,
    lines,
    messages: all,
    config: config(ctx.env),
    order: extra.order ?? orderFor(row, lines),
  });
}

function orderFor(row: SessionRow, lines: PricedLine[]) {
  if (row.status !== 'completed') return undefined;
  const first = lines[0];
  return {
    id: `ord_${row.id.replace(/^cs_/, '')}`,
    checkout_session_id: row.id,
    permalink_url: first
      ? `https://allmcps.com/mcp/${encodeURIComponent(first.serverId)}`
      : 'https://allmcps.com/dashboard',
    status: 'confirmed',
  };
}

async function load(ctx: Ctx, id: string): Promise<SessionRow | null> {
  const [row] = await ctx.db
    .select()
    .from(acpCheckoutSessions)
    .where(
      and(
        eq(acpCheckoutSessions.id, id),
        eq(acpCheckoutSessions.agentTokenHash, ctx.agent.tokenHash),
      ),
    )
    .limit(1);
  return row ?? null;
}

function newSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `cs_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function readItems(body: Record<string, unknown>) {
  return body.line_items !== undefined
    ? parseRequestedItems(body.line_items)
    : parseRequestedItems(body.items, 'items');
}

export async function createSession(ctx: Ctx): Promise<AcpResult> {
  const items = readItems(ctx.body);
  if (!Array.isArray(items)) return acpError(400, items);
  if (
    ctx.body.currency !== undefined &&
    String(ctx.body.currency).toLowerCase() !== 'usd'
  ) {
    return acpError(400, {
      type: 'invalid_request',
      code: 'invalid',
      message: 'Only usd is supported.',
      param: '$.currency',
    });
  }
  const parsedBuyer = parseBuyer(ctx.body.buyer);
  if (!parsedBuyer.ok) return acpError(400, parsedBuyer.error);
  const buyer = parsedBuyer.buyer;

  const now = new Date();
  const row: SessionRow = {
    id: newSessionId(),
    agentTokenHash: ctx.agent.tokenHash,
    status: 'not_ready_for_payment',
    items: JSON.stringify(items),
    buyer: buyer ? JSON.stringify(buyer) : null,
    stripePaymentIntentId: null,
    amountPaidCents: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: sessionExpiry(now.getTime()),
  };
  await ctx.db.insert(acpCheckoutSessions).values(row);
  return { status: 201, body: await render(ctx, row) };
}

export async function getSession(ctx: Ctx, id: string): Promise<AcpResult> {
  const row = await load(ctx, id);
  if (!row) return notFound();
  return { status: 200, body: await render(ctx, row) };
}

function notModifiable(status: string): AcpResult {
  return acpError(405, {
    type: 'invalid_request',
    code: 'invalid_state',
    message: `This checkout session is ${status} and can't be changed.`,
  });
}

export async function updateSession(ctx: Ctx, id: string): Promise<AcpResult> {
  const row = await load(ctx, id);
  if (!row) return notFound();
  const status = effectiveStatus(row, false);
  if (!OPEN_STATUSES.includes(status)) return notModifiable(status);

  const patch: Partial<SessionRow> = { updatedAt: new Date() };
  if (ctx.body.line_items !== undefined || ctx.body.items !== undefined) {
    const items = readItems(ctx.body);
    if (!Array.isArray(items)) return acpError(400, items);
    patch.items = JSON.stringify(items);
  }
  if (ctx.body.buyer !== undefined) {
    const parsed = parseBuyer(ctx.body.buyer);
    if (!parsed.ok) return acpError(400, parsed.error);
    patch.buyer = parsed.buyer ? JSON.stringify(parsed.buyer) : null;
  }
  await ctx.db
    .update(acpCheckoutSessions)
    .set(patch)
    .where(eq(acpCheckoutSessions.id, id));
  return { status: 200, body: await render(ctx, { ...row, ...patch }) };
}

export async function cancelSession(ctx: Ctx, id: string): Promise<AcpResult> {
  const row = await load(ctx, id);
  if (!row) return notFound();
  const status = effectiveStatus(row, false);
  if (!OPEN_STATUSES.includes(status)) return notModifiable(status);
  const updated = { ...row, status: 'canceled', updatedAt: new Date() };
  await ctx.db
    .update(acpCheckoutSessions)
    .set({ status: 'canceled', updatedAt: updated.updatedAt })
    .where(
      and(
        eq(acpCheckoutSessions.id, id),
        inArray(acpCheckoutSessions.status, OPEN_STATUSES),
      ),
    );
  return {
    status: 200,
    body: await render(ctx, updated, {
      messages: [
        {
          type: 'info',
          content_type: 'plain',
          content: 'Checkout session has been canceled.',
        },
      ],
    }),
  };
}

/** The SPT from payment_data, or an ACP error pointing at what's wrong. */
function sptFrom(body: Record<string, unknown>): string | AcpResult {
  const pd = body.payment_data as Record<string, unknown> | undefined;
  const bad = (message: string, param: string) =>
    acpError(400, { type: 'invalid_request', code: 'invalid', message, param });
  if (!pd || typeof pd !== 'object') {
    return bad('payment_data is required.', '$.payment_data');
  }
  if (pd.handler_id !== ACP_HANDLER_ID) {
    return bad(
      `Unsupported payment handler. Use "${ACP_HANDLER_ID}".`,
      '$.payment_data.handler_id',
    );
  }
  const credential = (pd.instrument as Record<string, unknown> | undefined)
    ?.credential as Record<string, unknown> | undefined;
  const token = credential?.token;
  if (
    credential?.type !== 'spt' ||
    typeof token !== 'string' ||
    !token.startsWith('spt_')
  ) {
    return bad(
      'Pay with a Stripe shared payment token: instrument.credential = { type: "spt", token: "spt_..." }.',
      '$.payment_data.instrument.credential',
    );
  }
  return token;
}

export async function completeSession(
  ctx: Ctx,
  id: string,
): Promise<AcpResult> {
  const row = await load(ctx, id);
  if (!row) return notFound();
  // Already paid: answer with the finished session rather than charge again.
  if (row.status === 'completed') {
    return { status: 200, body: await render(ctx, row) };
  }
  const current = effectiveStatus(row, false);
  if (!OPEN_STATUSES.includes(current)) return notModifiable(current);

  const token = sptFrom(ctx.body);
  if (typeof token !== 'string') return token;

  let buyerJson = row.buyer;
  if (ctx.body.buyer !== undefined) {
    const parsed = parseBuyer(ctx.body.buyer);
    if (!parsed.ok) return acpError(400, parsed.error);
    if (parsed.buyer) buyerJson = JSON.stringify(parsed.buyer);
  }
  const working = { ...row, buyer: buyerJson };

  const { lines, messages } = await priceItems(ctx.db, storedItems(row));
  if (messages.length > 0 || lines.length === 0) {
    // Not payable as it stands; the messages say why.
    return { status: 200, body: await render(ctx, working) };
  }
  const amount = lines.reduce((sum, l) => sum + l.totalCents, 0);

  // Claim the session so two completes can't both charge.
  const claimed = await ctx.db
    .update(acpCheckoutSessions)
    .set({
      status: 'complete_in_progress',
      buyer: buyerJson,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(acpCheckoutSessions.id, id),
        inArray(acpCheckoutSessions.status, OPEN_STATUSES),
      ),
    )
    .returning({ id: acpCheckoutSessions.id });
  if (claimed.length === 0) {
    return acpError(409, {
      type: 'invalid_request',
      code: 'conflict',
      message: 'This checkout session is already being completed.',
    });
  }

  const reopen = () =>
    ctx.db
      .update(acpCheckoutSessions)
      .set({ status: 'ready_for_payment', updatedAt: new Date() })
      .where(eq(acpCheckoutSessions.id, id));
  const declined = async (content: string) => {
    await reopen();
    return {
      status: 200,
      body: await render(ctx, working, {
        messages: [errorMessage('payment_declined', content, '$.payment_data')],
      }),
    };
  };

  const stripe = getStripe(config(ctx.env).stripeSecretKey);
  let paymentIntentId: string;
  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount,
        currency: 'usd',
        confirm: true,
        payment_method_data: { shared_payment_granted_token: token },
        description: `AllMCPs ${lines.map((l) => `${l.sku}:${l.serverId}`).join(', ')}`,
        metadata: {
          source: 'acp',
          acp_checkout_session: id,
          items: lines
            .map((l) => `${l.sku}:${l.serverId}x${l.weeks}`)
            .join(',')
            .slice(0, 500),
        },
        // SPT fields aren't in the stable SDK types yet.
      } as unknown as Parameters<typeof stripe.paymentIntents.create>[0],
      { idempotencyKey: `acp:${id}`, apiVersion: STRIPE_SPT_API_VERSION },
    );
    if (pi.status !== 'succeeded') {
      await stripe.paymentIntents.cancel(pi.id).catch(() => {});
      return declined(
        'The card needs an extra step (such as 3-D Secure) that this checkout does not support. Try another card.',
      );
    }
    paymentIntentId = pi.id;
  } catch (err) {
    const e = err as { type?: string; message?: string };
    if (
      e.type === 'StripeCardError' ||
      e.type === 'StripeInvalidRequestError'
    ) {
      console.warn(`[acp] payment failed for ${id}:`, e.message);
      return declined(e.message || 'The payment was declined.');
    }
    await reopen();
    throw err;
  }

  const email =
    (JSON.parse(buyerJson || 'null') as { email?: string } | null)?.email ??
    null;
  try {
    for (const [i, line] of lines.entries()) {
      await fulfillBoostPurchase(ctx.db, {
        serverId: line.serverId,
        sku: line.sku,
        weeks: line.weeks,
        amountCents: line.totalCents,
        attribution: null,
        paymentRef: `acp:${id}:${i}`,
        email,
      });
    }
  } catch (err) {
    // Charged but couldn't deliver: refund and say so.
    console.error(
      `[acp] PAID BUT NOT FULFILLED ${id} pi=${paymentIntentId}:`,
      err,
    );
    const refunded = await stripe.refunds
      .create({ payment_intent: paymentIntentId })
      .then(() => true)
      .catch((refundErr) => {
        console.error(`[acp] refund failed for ${paymentIntentId}:`, refundErr);
        return false;
      });
    await ctx.db
      .update(acpCheckoutSessions)
      .set({
        status: 'canceled',
        stripePaymentIntentId: paymentIntentId,
        updatedAt: new Date(),
      })
      .where(eq(acpCheckoutSessions.id, id));
    return acpError(500, {
      type: 'processing_error',
      code: 'fulfillment_failed',
      message: refunded
        ? 'Payment succeeded but we could not activate the purchase, so we refunded it in full.'
        : `Payment succeeded but we could not activate the purchase. Email support@allmcps.com quoting ${paymentIntentId} and we will fix it or refund you.`,
    });
  }

  const done: SessionRow = {
    ...working,
    status: 'completed',
    stripePaymentIntentId: paymentIntentId,
    amountPaidCents: amount,
    updatedAt: new Date(),
  };
  await ctx.db
    .update(acpCheckoutSessions)
    .set({
      status: 'completed',
      stripePaymentIntentId: paymentIntentId,
      amountPaidCents: amount,
      updatedAt: done.updatedAt,
    })
    .where(eq(acpCheckoutSessions.id, id));
  return { status: 200, body: await render(ctx, done) };
}
