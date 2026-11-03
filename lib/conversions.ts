import { and, desc, eq, gte } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { conversions } from '../db/schema';
import {
  type Attribution,
  type Channel,
  classifyChannel,
  type HeardFrom,
} from './attribution';

export type ConversionKind = 'submission' | 'purchase' | 'ad_purchase';

/**
 * Records one conversion with its attribution. Best effort: a failure is
 * logged, never thrown, so attribution can't break a submission or a webhook.
 * Webhook retries are deduped by the unique stripe_session_id index.
 */
export async function recordConversion(
  db: DrizzleD1Database,
  input: {
    kind: ConversionKind;
    serverId?: string | null;
    adId?: string | null;
    sku?: string | null;
    amountCents?: number | null;
    attribution: Attribution | null;
    heardFrom?: HeardFrom | null;
    stripeSessionId?: string | null;
  },
) {
  const a = input.attribution;
  try {
    await db
      .insert(conversions)
      .values({
        kind: input.kind,
        serverId: input.serverId ?? null,
        adId: input.adId ?? null,
        sku: input.sku ?? null,
        amountCents: Math.max(0, Math.round(input.amountCents ?? 0)),
        channel: classifyChannel(a),
        refHost: a?.ref ?? null,
        utmSource: a?.src ?? null,
        utmMedium: a?.med ?? null,
        utmCampaign: a?.cmp ?? null,
        landingPath: a?.land ?? null,
        firstSeenAt: a ? new Date(a.ts) : null,
        heardFrom: input.heardFrom ?? null,
        stripeSessionId: input.stripeSessionId ?? null,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error('[conversions] record failed:', err);
  }
}

/**
 * The listing's submission conversion, used when a purchase arrives without
 * its own attribution (cookie missing at checkout): the buyer is almost always
 * the author who submitted, so their submission touch is the best evidence.
 */
export async function submissionTouchFor(
  db: DrizzleD1Database,
  serverId: string,
) {
  const [row] = await db
    .select()
    .from(conversions)
    .where(
      and(
        eq(conversions.kind, 'submission'),
        eq(conversions.serverId, serverId),
      ),
    )
    .orderBy(desc(conversions.createdAt))
    .limit(1);
  if (!row) return null;
  const attribution: Attribution | null = row.firstSeenAt
    ? {
        ref: row.refHost,
        src: row.utmSource,
        med: row.utmMedium,
        cmp: row.utmCampaign,
        land: row.landingPath,
        ts: row.firstSeenAt.getTime(),
      }
    : null;
  return {
    attribution,
    heardFrom: (row.heardFrom as HeardFrom | null) ?? null,
  };
}

export type ConversionRow = typeof conversions.$inferSelect;

export type AcquisitionBucket = {
  key: string;
  submissions: number;
  purchases: number;
  revenueCents: number;
};

export type AcquisitionReport = {
  days: number;
  totals: AcquisitionBucket;
  byChannel: AcquisitionBucket[];
  bySource: AcquisitionBucket[];
  byLanding: AcquisitionBucket[];
  byCampaign: AcquisitionBucket[];
  byHeardFrom: AcquisitionBucket[];
  bySku: AcquisitionBucket[];
  recent: Array<{
    id: number;
    kind: string;
    serverId: string | null;
    adId: string | null;
    sku: string | null;
    amountCents: number;
    channel: string;
    source: string;
    landingPath: string | null;
    heardFrom: string | null;
    createdAt: string;
  }>;
};

/** Display label for where a conversion came from: UTM source, else referrer host. */
function sourceLabel(row: {
  channel: string;
  refHost: string | null;
  utmSource: string | null;
}) {
  return row.utmSource || row.refHost || (row.channel as Channel);
}

function isPaid(kind: string) {
  return kind === 'purchase' || kind === 'ad_purchase';
}

/** Pure aggregation over conversion rows (tested without D1). */
export function buildAcquisitionReport(
  rows: ConversionRow[],
  days: number,
  recentLimit = 50,
): AcquisitionReport {
  const groups: Record<string, Map<string, AcquisitionBucket>> = {
    channel: new Map(),
    source: new Map(),
    landing: new Map(),
    campaign: new Map(),
    heardFrom: new Map(),
    sku: new Map(),
  };
  const totals: AcquisitionBucket = {
    key: 'total',
    submissions: 0,
    purchases: 0,
    revenueCents: 0,
  };

  const add = (group: string, key: string | null, r: ConversionRow) => {
    if (!key) return;
    const map = groups[group];
    let b = map.get(key);
    if (!b) {
      b = { key, submissions: 0, purchases: 0, revenueCents: 0 };
      map.set(key, b);
    }
    if (isPaid(r.kind)) {
      b.purchases++;
      b.revenueCents += r.amountCents;
    } else {
      b.submissions++;
    }
  };

  for (const r of rows) {
    add('channel', r.channel, r);
    add('source', sourceLabel(r), r);
    add('landing', r.landingPath ?? '(unknown)', r);
    add('campaign', r.utmCampaign, r);
    add('heardFrom', r.heardFrom, r);
    if (isPaid(r.kind)) add('sku', r.sku ?? r.kind, r);
    if (isPaid(r.kind)) {
      totals.purchases++;
      totals.revenueCents += r.amountCents;
    } else {
      totals.submissions++;
    }
  }

  const sorted = (m: Map<string, AcquisitionBucket>) =>
    [...m.values()].sort(
      (a, b) =>
        b.revenueCents - a.revenueCents ||
        b.purchases - a.purchases ||
        b.submissions - a.submissions ||
        a.key.localeCompare(b.key),
    );

  const recent = [...rows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, recentLimit)
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      serverId: r.serverId,
      adId: r.adId,
      sku: r.sku,
      amountCents: r.amountCents,
      channel: r.channel,
      source: sourceLabel(r),
      landingPath: r.landingPath,
      heardFrom: r.heardFrom,
      createdAt: r.createdAt.toISOString(),
    }));

  return {
    days,
    totals,
    byChannel: sorted(groups.channel),
    bySource: sorted(groups.source),
    byLanding: sorted(groups.landing),
    byCampaign: sorted(groups.campaign),
    byHeardFrom: sorted(groups.heardFrom),
    bySku: sorted(groups.sku),
    recent,
  };
}

/** Upper bound on rows aggregated in the Worker; plenty for this volume. */
const MAX_ROWS = 20_000;

export async function loadConversions(db: DrizzleD1Database, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(conversions)
    .where(gte(conversions.createdAt, since))
    .orderBy(desc(conversions.createdAt))
    .limit(MAX_ROWS);
}

/**
 * LopeBase's standard acquisition resources (`acquisition_sources`,
 * `acquisition_landing_pages`) and stats: aggregates only, last 28 days.
 * Field names are the adapter convention LopeBase reads, so keep them stable.
 */
export function acquisitionForLopebase(rows: ConversionRow[]) {
  const sources = new Map<string, Record<string, string | number>>();
  const pages = new Map<string, Record<string, string | number>>();
  let conversionsTotal = 0;
  let paidTotal = 0;
  let revenueCents = 0;

  const bump = (
    row: Record<string, string | number>,
    paid: boolean,
    cents: number,
  ) => {
    row.conversions = Number(row.conversions) + 1;
    if (paid) {
      row.paid_conversions = Number(row.paid_conversions) + 1;
      row.revenue_cents = Number(row.revenue_cents) + cents;
    }
  };

  for (const r of rows) {
    const paid = isPaid(r.kind);
    conversionsTotal++;
    if (paid) {
      paidTotal++;
      revenueCents += r.amountCents;
    }
    const source = sourceLabel(r);
    const sourceId = `${r.channel}|${source}`;
    let sourceRow = sources.get(sourceId);
    if (!sourceRow) {
      sourceRow = {
        id: sourceId,
        channel: r.channel,
        source,
        conversions: 0,
        paid_conversions: 0,
        revenue_cents: 0,
      };
      sources.set(sourceId, sourceRow);
    }
    bump(sourceRow, paid, r.amountCents);

    const path = r.landingPath ?? '(unknown)';
    let pageRow = pages.get(path);
    if (!pageRow) {
      pageRow = {
        id: path,
        path,
        conversions: 0,
        paid_conversions: 0,
        revenue_cents: 0,
      };
      pages.set(path, pageRow);
    }
    bump(pageRow, paid, r.amountCents);
  }

  const finish = (
    m: Map<string, Record<string, string | number>>,
  ): Record<string, string | number>[] =>
    [...m.values()]
      .sort(
        (a, b) =>
          Number(b.revenue_cents) - Number(a.revenue_cents) ||
          Number(b.conversions) - Number(a.conversions) ||
          String(a.id).localeCompare(String(b.id)),
      )
      .map(({ revenue_cents, ...rest }) => ({
        ...rest,
        revenue_usd: Number(revenue_cents) / 100,
      }));

  return {
    sources: finish(sources),
    landingPages: finish(pages),
    stats: {
      conversions_28d: conversionsTotal,
      paid_conversions_28d: paidTotal,
      revenue_28d_usd: revenueCents / 100,
    },
  };
}
