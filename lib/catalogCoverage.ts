import { desc, gt, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { searchMisses, servers } from '../db/schema';
import { DEFAULT_SUBMIT_CATEGORY } from './categories';
import {
  INDEXABLE_MIN_GITHUB_STARS,
  INDEXABLE_MIN_NPM_DOWNLOADS,
  INDEXABLE_STRONG_GITHUB_STARS,
  INDEXABLE_STRONG_NPM_DOWNLOADS,
} from './listingIndexability';

/**
 * How complete the public catalog is, field by field, for servable listings
 * (active and not flagged — lib/servability.ts). One aggregate pass over
 * `servers`, so it lives behind its own admin endpoint instead of the stats
 * bar, which re-polls on every admin action.
 */

const FRESH_CHECK_MS = 7 * 24 * 60 * 60 * 1000;
const DEMAND_GAP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const DEMAND_GAP_LIMIT = 50;

export type CatalogCoverage = {
  total: number;
  fields: {
    key: string;
    label: string;
    count: number;
    /** What a low number means and what fills it. */
    hint: string;
  }[];
};

export type DemandGap = {
  query: string;
  surface: string;
  count: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

type Db = ReturnType<typeof drizzle>;

const hasText = (col: unknown) => sql`coalesce(${col}, '') <> ''`;
const hasJsonList = (col: unknown) =>
  sql`coalesce(${col}, '') NOT IN ('', '[]', 'null')`;
const countIf = (cond: ReturnType<typeof sql>) =>
  sql<number>`sum(CASE WHEN ${cond} THEN 1 ELSE 0 END)`;

export async function getCatalogCoverage(
  db: Db,
  now: Date = new Date(),
): Promise<CatalogCoverage> {
  const freshCutoff = Math.floor((now.getTime() - FRESH_CHECK_MS) / 1000);
  const hasTools = hasJsonList(servers.tools);
  // Mirrors lib/listingIndexability.ts (status and flag are already filtered).
  const stars = sql`coalesce(${servers.githubStars}, 0)`;
  const downloads = sql`coalesce(${servers.npmDownloads}, 0)`;
  const traction = sql`(${stars} >= ${INDEXABLE_MIN_GITHUB_STARS} OR ${downloads} >= ${INDEXABLE_MIN_NPM_DOWNLOADS})`;
  const strongTraction = sql`(${stars} >= ${INDEXABLE_STRONG_GITHUB_STARS} OR ${downloads} >= ${INDEXABLE_STRONG_NPM_DOWNLOADS})`;
  const verifiedRun = sql`(${servers.toolsSource} = 'introspected' OR ${servers.installNeedsConfig} IS NOT NULL OR coalesce(${servers.remoteEndpointHealthy}, 0) = 1)`;
  const indexable = sql`${hasText(servers.aiDoc)} AND (${strongTraction} OR (${traction} AND ${verifiedRun}))`;

  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      aiDoc: countIf(hasText(servers.aiDoc)),
      aiFaq: countIf(hasJsonList(servers.aiFaq)),
      toolsIntrospected: countIf(
        sql`${hasTools} AND ${servers.toolsSource} = 'introspected'`,
      ),
      toolsReadme: countIf(
        sql`${hasTools} AND coalesce(${servers.toolsSource}, '') <> 'introspected'`,
      ),
      install: countIf(sql`${servers.installKind} IS NOT NULL`),
      logo: countIf(hasText(servers.logoUrl)),
      website: countIf(hasText(servers.websiteUrl)),
      categorized: countIf(
        sql`${servers.category} <> ${DEFAULT_SUBMIT_CATEGORY}`,
      ),
      vulnScanned: countIf(sql`${servers.vulnScannedAt} IS NOT NULL`),
      checkedRecently: countIf(sql`${servers.lastCheckedAt} >= ${freshCutoff}`),
      indexable: countIf(indexable),
    })
    .from(servers)
    .where(
      sql`${servers.status} = 'active' AND ${servers.staleFlaggedAt} IS NULL`,
    );

  const n = (v: unknown) => Number(v ?? 0);
  const total = n(row?.total);
  const toolsAny = n(row?.toolsIntrospected) + n(row?.toolsReadme);
  return {
    total,
    fields: [
      {
        key: 'indexable',
        label: 'Indexable',
        count: n(row?.indexable),
        hint: 'Writeup plus traction and a verified run, or strong traction alone (lib/listingIndexability.ts). Only these enter the sitemap.',
      },
      {
        key: 'aiDoc',
        label: 'AI writeup',
        count: n(row?.aiDoc),
        hint: 'Filled by the ai-content cron, changed and in-demand listings first.',
      },
      {
        key: 'aiFaq',
        label: 'FAQ',
        count: n(row?.aiFaq),
        hint: 'Filled by the ai-faq cron for listings with a writeup.',
      },
      {
        key: 'toolsIntrospected',
        label: 'Tools (verified)',
        count: n(row?.toolsIntrospected),
        hint: 'Live tools/list from a remote handshake or the sandbox run.',
      },
      {
        key: 'toolsReadme',
        label: 'Tools (README only)',
        count: n(row?.toolsReadme),
        hint: 'Parsed from the README, not observed. Verification replaces these.',
      },
      {
        key: 'toolsNone',
        label: 'No tools',
        count: total - toolsAny,
        hint: 'Neither verified nor found in the README.',
      },
      {
        key: 'install',
        label: 'Install known',
        count: n(row?.install),
        hint: 'install_kind set by the ai-content install pass or health cron.',
      },
      {
        key: 'logo',
        label: 'Logo',
        count: n(row?.logo),
        hint: 'Logo cascade in the enrich cron.',
      },
      {
        key: 'website',
        label: 'Website',
        count: n(row?.website),
        hint: 'Found by the enrich cron from the repo homepage or README.',
      },
      {
        key: 'categorized',
        label: 'Specific category',
        count: n(row?.categorized),
        hint: `Not in the "${DEFAULT_SUBMIT_CATEGORY}" default. The enrich cron re-classifies the default pile every tick.`,
      },
      {
        key: 'vulnScanned',
        label: 'Vuln-scanned',
        count: n(row?.vulnScanned),
        hint: 'OSV advisory lookup by the vuln-scan cron.',
      },
      {
        key: 'checkedRecently',
        label: 'Health-checked (7d)',
        count: n(row?.checkedRecently),
        hint: 'Health cron pass in the last 7 days.',
      },
    ],
  };
}

/** Most-missed searches in the last 30 days — what people want that we lack. */
export async function getDemandGaps(
  db: Db,
  now: Date = new Date(),
): Promise<DemandGap[]> {
  const since = new Date(now.getTime() - DEMAND_GAP_WINDOW_MS);
  const rows = await db
    .select({
      query: searchMisses.query,
      surface: searchMisses.surface,
      count: searchMisses.count,
      firstSeenAt: searchMisses.firstSeenAt,
      lastSeenAt: searchMisses.lastSeenAt,
    })
    .from(searchMisses)
    .where(gt(searchMisses.lastSeenAt, since))
    .orderBy(desc(searchMisses.count), desc(searchMisses.lastSeenAt))
    .limit(DEMAND_GAP_LIMIT);
  const iso = (d: Date | null) => (d instanceof Date ? d.toISOString() : null);
  return rows.map((r) => ({
    query: r.query,
    surface: r.surface,
    count: Number(r.count),
    firstSeenAt: iso(r.firstSeenAt),
    lastSeenAt: iso(r.lastSeenAt),
  }));
}
