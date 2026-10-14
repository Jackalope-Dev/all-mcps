import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { autoDecisions, reports, servers } from '../../../../db/schema';
import {
  getGateModes,
  markActed,
  recordDecision,
} from '../../../../lib/autoDecision';
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
 *   AUTO    every member points at the same repo directory as the keeper.
 *           With the 'dedupe_retire' gate live, the others are retired the
 *           way /admin's "merge duplicate" does it (status='removed', 308 to
 *           the keeper when it is active). In shadow (the default) the
 *           decision is recorded and a report is filed instead; an undone
 *           retirement is never repeated.
 *   REVIEW  same name/site, different repos: a 'duplicate' report goes to
 *           /admin → Reports for a human, once per loser/keeper pair (a
 *           dismissed report is not filed again). Nothing is changed.
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

    const mode = (await getGateModes(db)).dedupe_retire;
    const loserIds = clusters.flatMap((c) => c.losers.map((l) => l.id));

    // Duplicate reports already filed for a loser, open or not: once an admin
    // dismisses "not a duplicate", the next weekly run must not file it again.
    const reportedPairs = new Set<string>();
    // Retirements an admin undid: that pair is not a duplicate.
    const undone = new Set<string>();
    for (let i = 0; i < loserIds.length; i += ID_CHUNK) {
      const chunk = loserIds.slice(i, i + ID_CHUNK);
      const found = await db
        .select({ serverId: reports.serverId, details: reports.details })
        .from(reports)
        .where(
          and(
            inArray(reports.serverId, chunk),
            eq(reports.reason, 'duplicate'),
          ),
        );
      for (const f of found) {
        const keeper = /\/mcp\/([^\s)]+)/.exec(f.details ?? '')?.[1];
        if (keeper) reportedPairs.add(`${f.serverId}>${keeper}`);
      }
      const decisions = await db
        .select({ serverId: autoDecisions.serverId })
        .from(autoDecisions)
        .where(
          and(
            eq(autoDecisions.gate, 'dedupe_retire'),
            inArray(autoDecisions.serverId, chunk),
            isNotNull(autoDecisions.undoneAt),
          ),
        );
      for (const d of decisions) undone.add(d.serverId);
    }

    const retired: string[] = [];
    let reported = 0;
    let shadowed = 0;
    const fileReport = async (
      loserId: string,
      keeper: (typeof clusters)[number]['keeper'],
      sameRepo: boolean,
    ) => {
      const pair = `${loserId}>${keeper.id}`;
      if (reported >= MAX_REPORTS || reportedPairs.has(pair)) return;
      await db.insert(reports).values({
        serverId: loserId,
        reason: 'duplicate',
        details: sameRepo
          ? `Automated weekly sweep: duplicate of /mcp/${keeper.id} (${keeper.url}) — same repo directory. Merge it in /admin, or dismiss if they differ.`
          : `Automated weekly sweep: possible duplicate of /mcp/${keeper.id} (${keeper.url}). Same URL or same name + website, but a different repo — merge it in /admin if it is the same project.`,
        status: 'open',
        createdAt: now,
      });
      reportedPairs.add(pair);
      reported++;
    };

    for (const cluster of clusters) {
      const { keeper } = cluster;
      if (cluster.tier === 'auto' && mode !== 'off') {
        // Same rule as /admin merge_duplicate: only redirect to an active,
        // un-redirected keeper; otherwise just retire.
        const redirectTo =
          keeper.status === 'active' && !keeper.redirectTo ? keeper.id : null;
        for (const loser of cluster.losers) {
          if (undone.has(loser.id)) continue;
          await recordDecision(db, {
            gate: 'dedupe_retire',
            serverId: loser.id,
            decision: 'approve',
            reason: `Same repo directory as /mcp/${keeper.id}`,
            evidence: {
              keeper: keeper.id,
              keeperUrl: keeper.url,
              url: loser.url,
            },
            mode: mode === 'live' ? 'live' : 'shadow',
          });
          if (mode !== 'live') {
            // Shadow: a human sees it as a report and the gate builds a record.
            shadowed++;
            await fileReport(loser.id, keeper, true);
            continue;
          }
          if (retired.length >= MAX_RETIRE) break;
          const res = await db
            .update(servers)
            .set({
              status: 'removed',
              ...(redirectTo ? { redirectTo } : {}),
            })
            .where(and(eq(servers.id, loser.id), ne(servers.status, 'removed')))
            .returning({ id: servers.id });
          if (res.length > 0) {
            retired.push(loser.id);
            await markActed(db, 'dedupe_retire', loser.id);
          }
        }
        continue;
      }
      for (const loser of cluster.losers) {
        if (undone.has(loser.id)) continue;
        await fileReport(loser.id, keeper, cluster.tier === 'auto');
      }
    }

    const pages = await refreshListingPages(retired, env);
    const result = {
      rowsScanned: slim.length,
      clusters: clusters.length,
      autoClusters: clusters.filter((c) => c.tier === 'auto').length,
      gateMode: mode,
      retired: retired.length,
      shadowed,
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
