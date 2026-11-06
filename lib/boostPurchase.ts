import { and, eq, gt, ne } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { servers } from '@/db/schema';
import type { Attribution } from '@/lib/attribution';
import { recordConversion, submissionTouchFor } from '@/lib/conversions';
import type { PaidSku } from '@/lib/pricing';
import { syncSequenzySubscriber } from '@/lib/sequenzy';

type ServerRow = typeof servers.$inferSelect;

/**
 * Why `server` can't buy `sku` right now, or null if it can. Shared by Stripe
 * checkout and x402 so both rails refuse the same purchases.
 */
export async function boostEligibilityError(
  db: DrizzleD1Database,
  server: ServerRow,
  sku: PaidSku,
): Promise<{ status: number; error: string } | null> {
  if (sku === 'priority_review' && server.status !== 'pending') {
    return {
      status: 400,
      error:
        'Priority review is only available for listings still awaiting approval.',
    };
  }

  if (sku !== 'priority_review' && server.status !== 'active') {
    return {
      status: 400,
      error:
        'Featured, Category Sponsor, and Premium are available after your listing is approved.',
    };
  }

  if (
    sku === 'premium_monthly' &&
    server.isPremium &&
    server.premiumStatus === 'active'
  ) {
    return {
      status: 400,
      error: 'This listing already has an active Premium subscription.',
    };
  }

  if (sku === 'category_sponsor_7d') {
    const existingSponsor = await db
      .select({ categorySponsorUntil: servers.categorySponsorUntil })
      .from(servers)
      .where(
        and(
          eq(servers.category, server.category),
          ne(servers.id, server.id),
          gt(servers.categorySponsorUntil, new Date()),
        ),
      )
      .limit(1);

    if (existingSponsor.length > 0) {
      const until = existingSponsor[0].categorySponsorUntil
        ? new Date(existingSponsor[0].categorySponsorUntil).toLocaleDateString()
        : 'soon';
      return {
        status: 409,
        error: `"${server.category}" is already sponsored by another listing until ${until}. Only one category sponsor runs at a time — check back after it expires.`,
      };
    }
  }

  return null;
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Extends from the current expiry if it's still in the future, else from now. */
function extendFrom(current: Date | null | undefined, days: number): Date {
  const base =
    current && new Date(current).getTime() > Date.now()
      ? new Date(current)
      : new Date();
  return addDays(base, days);
}

export type BoostFulfillment = {
  serverId: string;
  sku: PaidSku;
  /** Weeks bought — only read for weekly SKUs. */
  weeks: number;
  amountCents: number | null;
  attribution: Attribution | null;
  /** Unique per payment (Stripe session id, or `x402:<tx hash>`); dedupes the conversion row. */
  paymentRef: string;
  email: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

/**
 * Turns on what was paid for, records the conversion, and tags the buyer in
 * Sequenzy. Called by the Stripe webhook and the x402 boost endpoint.
 */
export async function fulfillBoostPurchase(
  db: DrizzleD1Database,
  input: BoostFulfillment,
): Promise<ServerRow | undefined> {
  const { serverId, sku, stripeCustomerId: customerId } = input;
  const [current] = await db
    .select()
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  const customer = customerId ? { stripeCustomerId: customerId } : {};

  if (sku === 'priority_review') {
    await db
      .update(servers)
      .set({ reviewPriority: true, ...customer })
      .where(eq(servers.id, serverId));
  } else if (sku === 'featured_7d' || sku === 'category_sponsor_7d') {
    const durationDays = 7 * Math.max(1, input.weeks);
    // category_sponsor_7d also gets the featured badge/glow (same as featured_7d),
    // plus its own categorySponsorUntil — the field the category page actually pins
    // on. Kept separate so a plain featured_7d purchase never accidentally pins.
    await db
      .update(servers)
      .set({
        featuredUntil: extendFrom(current?.featuredUntil, durationDays),
        ...(sku === 'category_sponsor_7d'
          ? {
              categorySponsorUntil: extendFrom(
                current?.categorySponsorUntil,
                durationDays,
              ),
            }
          : {}),
        ...customer,
      })
      .where(eq(servers.id, serverId));
  } else if (sku === 'premium_monthly') {
    await db
      .update(servers)
      .set({
        isPremium: true,
        premiumStatus: 'active',
        ...customer,
        ...(input.stripeSubscriptionId
          ? { stripeSubscriptionId: input.stripeSubscriptionId }
          : {}),
      })
      .where(eq(servers.id, serverId));
  }

  // Purchases made without the attribution cookie (agent API, x402, cleared
  // cookies, consent declined) fall back to the listing's submission touch:
  // the buyer is nearly always the author who submitted it.
  const submissionTouch = await submissionTouchFor(db, serverId).catch(
    () => null,
  );
  await recordConversion(db, {
    kind: 'purchase',
    serverId,
    sku,
    amountCents: input.amountCents,
    attribution: input.attribution ?? submissionTouch?.attribution ?? null,
    heardFrom: submissionTouch?.heardFrom ?? null,
    stripeSessionId: input.paymentRef,
  });

  const email = input.email || current?.submitterEmail || null;
  if (email) {
    try {
      await syncSequenzySubscriber({ email, tags: [`paid-${sku}`] });
    } catch (err) {
      console.error(`Failed to sync Sequenzy subscriber for ${email}:`, err);
    }
  }

  const [updated] = await db
    .select()
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  return updated;
}
