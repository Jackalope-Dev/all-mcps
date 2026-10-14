import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { reports, servers } from '../../../../db/schema';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import { refreshListingPages } from '../../../../lib/listingPageRefresh';
import {
  type DedupeRow,
  findDuplicateClusters,
} from '../../../../lib/nearDuplicates';
import {
  normalizeNameSiteKey,
  normalizeUrlKey,
} from '../../../../lib/urlDedup';

/**
 * Weekly near-duplicate sweep — scripts/dedupe-listings.mjs on a schedule,
 * with the same clustering rules (lib/nearDuplicates.ts). Intake only blocks
 * an exact repo-URL match, so the same project arriving under another org or
 * a marketing URL slips in as foo, foo-2…
 *
 *   AUTO    every member points at the same repo as the keeper: the others
 *           are retired the way /admin's "merge duplicate" does it
 *           (status='removed', 308 to the keeper when it is active).
 *   REVIEW  same name/site, different repos: an open 'duplicate' report goes
 *           to /admin → Reports for a human. Nothing is changed.
 *
 * Two reads keep memory flat: four short columns for every row to find which
 * keys collide, then full rows only for the colliding ids.
 */

const MAX_RETIRE = 200;
const MAX_REPORTS = 200;
/** Ids per IN (...) — D1 caps bound parameters at 100 per statement. */
const ID_CHUNK = 90;

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { env } = await getCloudflareContext();
    if (!env?.DB) throw new Error('Database binding not found');
    const db = drizzle(env.DB as any);
    const now = new Date();

    // Pass 1: which ids share a key with another row?
    const slim = await db
      .select({
        id: servers.id,
        name: servers.name,
        url: servers.url,
        websiteUrl: servers.websiteUrl,
      })
      .from(servers);
    const byKey = new Map<string, string[]>();
    const add = (key: string, id: string) => {
      if (!key) return;
      const list = byKey.get(key);
      if (list) list.push(id);
      else byKey.set(key, [id]);
    };
    for (const r of slim) {
      if (r.url) add(`url:${normalizeUrlKey(r.url)}`, r.id);
      const ns = normalizeNameSiteKey(r.name, r.websiteUrl);
      if (ns) add(`ns:${ns}`, r.id);
    }
    const colliding = new Set<string>();
    for (const ids of byKey.values()) {
      if (ids.length > 1) for (const id of ids) colliding.add(id);
    }
    byKey.clear();

    // Pass 2: full rows for just those ids.
    const ids = [...colliding];
    const rows: (DedupeRow & { redirectTo: string | null })[] = [];
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const chunk = await db
        .select({
          id: servers.id,
          name: servers.name,
          url: servers.url,
          websiteUrl: servers.websiteUrl,
          status: servers.status,
          views: servers.views,
          copies: servers.copies,
          upvotes: servers.upvotes,
          githubStars: servers.githubStars,
          npmDownloads: servers.npmDownloads,
          isOfficial: servers.isOfficial,
          isPremium: servers.isPremium,
          createdAt: servers.createdAt,
          aiEnrichedAt: servers.aiEnrichedAt,
          ownerUserId: servers.ownerUserId,
          featuredUntil: servers.featuredUntil,
          redirectTo: servers.redirectTo,
        })
        .from(servers)
        .where(inArray(servers.id, ids.slice(i, i + ID_CHUNK)));
      rows.push(...chunk);
    }

    const clusters = findDuplicateClusters(rows, now);

    // Open duplicate reports already filed, so a weekly re-run adds nothing new.
    const openReports = new Set<string>();
    const reviewLoserIds = clusters
      .filter((c) => c.tier === 'review')
      .flatMap((c) => c.losers.map((l) => l.id));
    for (let i = 0; i < reviewLoserIds.length; i += ID_CHUNK) {
      const found = await db
        .select({ serverId: reports.serverId })
        .from(reports)
        .where(
          and(
            inArray(reports.serverId, reviewLoserIds.slice(i, i + ID_CHUNK)),
            eq(reports.reason, 'duplicate'),
            eq(reports.status, 'open'),
          ),
        );
      for (const f of found) openReports.add(f.serverId);
    }

    const retired: string[] = [];
    let reported = 0;
    for (const cluster of clusters) {
      const { keeper } = cluster;
      if (cluster.tier === 'auto') {
        // Same rule as /admin merge_duplicate: only redirect to an active,
        // un-redirected keeper; otherwise just retire.
        const redirectTo =
          keeper.status === 'active' && !keeper.redirectTo ? keeper.id : null;
        for (const loser of cluster.losers) {
          if (retired.length >= MAX_RETIRE) break;
          const res = await db
            .update(servers)
            .set({
              status: 'removed',
              ...(redirectTo ? { redirectTo } : {}),
            })
            .where(and(eq(servers.id, loser.id), ne(servers.status, 'removed')))
            .returning({ id: servers.id });
          if (res.length > 0) retired.push(loser.id);
        }
        continue;
      }
      for (const loser of cluster.losers) {
        if (reported >= MAX_REPORTS || openReports.has(loser.id)) continue;
        await db.insert(reports).values({
          serverId: loser.id,
          reason: 'duplicate',
          details: `Automated weekly sweep: possible duplicate of /mcp/${keeper.id} (${keeper.url}). Same URL or same name + website, but a different repo — merge it in /admin if it is the same project.`,
          status: 'open',
          createdAt: now,
        });
        openReports.add(loser.id);
        reported++;
      }
    }

    const pages = await refreshListingPages(retired, env);
    const result = {
      rowsScanned: slim.length,
      clusters: clusters.length,
      autoClusters: clusters.filter((c) => c.tier === 'auto').length,
      retired: retired.length,
      reported,
      pagesRefreshed: pages.refreshed.length,
    };
    console.log('[dedupe]', JSON.stringify(result));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[dedupe] failed', error);
    return NextResponse.json({ error: 'Dedupe failed.' }, { status: 500 });
  }
}
