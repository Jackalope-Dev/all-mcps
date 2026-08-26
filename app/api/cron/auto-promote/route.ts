import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { eq, and, isNull, lt } from 'drizzle-orm';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { isSafeFetchTarget } from '../../../../lib/urlSafety';
import { isPackageInstallable } from '../../../../lib/listingEnrich';
import { notifyListingIndexed } from '../../../../lib/indexnow';

/**
 * Fully-unattended promotion for pending listings that came from our own
 * automated ingestion (scripts/ingest-sources.mjs), never from a human
 * /api/submit submission — those always set submitterEmail and keep
 * requiring real admin review via /admin (see app/api/admin/action/route.ts).
 * submitterEmail is a required field on that form, so `IS NULL` reliably
 * means "landed via direct SQL from the ingest script," which is the only
 * other path that creates a `pending` row.
 *
 * Ingested candidates already passed a quality floor + duplicate-flag review
 * at ingest time, but sources we haven't personally vetted (pulsemcp,
 * awesome-lists) get one more independent bar before going public: they have
 * to still be *alive* after sitting untouched for PROMOTION_DWELL_MS, checked
 * fresh here rather than trusting the one-time ingest-time check. A
 * candidate that fails the fresh check isn't retried forever — once it's
 * been pending for STALE_REMOVAL_MS with no working interface, it's moved to
 * 'removed' (same fate a truly-dead active listing gets — see
 * isListingTrulyDead in lib/listingEnrich.ts) so this queue self-cleans
 * instead of silently accumulating dead weight nobody ever looks at.
 *
 * Deliberately does NOT replicate every admin-approve side effect: no
 * submitter email (there isn't one) and no forced tweet (the highlight cron
 * already rotates through active listings, so a promoted one gets picked up
 * naturally without a bot-like burst of tweets on ingest day). It DOES ping
 * IndexNow, same as a human approval, since fast discovery is the whole
 * point of promoting at all.
 */

const BATCH_SIZE = 50;
const PROMOTION_DWELL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STALE_REMOVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LIVENESS_TIMEOUT_MS = 8000;

async function checkUrlAlive(url: string | null | undefined): Promise<boolean> {
  if (!url || !isSafeFetchTarget(url)) return false;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'AllMCPs-AutoPromote' },
      signal: AbortSignal.timeout(LIVENESS_TIMEOUT_MS),
    });
    if (res.status === 405 || res.status === 501) {
      const getRes = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'AllMCPs-AutoPromote' },
        signal: AbortSignal.timeout(LIVENESS_TIMEOUT_MS),
      });
      return getRes.ok;
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }
    const db = drizzle(env.DB as any);

    const dwellCutoff = new Date(Date.now() - PROMOTION_DWELL_MS);
    const candidates = await db
      .select()
      .from(servers)
      .where(
        and(eq(servers.status, 'pending'), isNull(servers.submitterEmail), lt(servers.createdAt, dwellCutoff))
      )
      .limit(BATCH_SIZE);

    let promoted = 0;
    let removedCount = 0;
    let stillPending = 0;

    for (const s of candidates) {
      // Multi-interface alive check (mirrors isListingTrulyDead's philosophy in
      // reverse): any one working interface is enough to promote.
      const urlAlive = await checkUrlAlive(s.url);
      const packageAlive =
        !urlAlive && s.installPackage ? await isPackageInstallable(s.installCommand, s.installPackage) : false;
      const remoteAlive =
        !urlAlive && !packageAlive && s.remoteEndpointUrl ? await checkUrlAlive(s.remoteEndpointUrl) : false;

      if (urlAlive || packageAlive || remoteAlive) {
        const result = await db
          .update(servers)
          .set({ status: 'active' })
          .where(and(eq(servers.id, s.id), eq(servers.status, 'pending')))
          .returning();
        if (result.length > 0) {
          promoted++;
          void notifyListingIndexed(s.id, ['/browse', '/sitemap.xml']).catch(() => {});
        }
        continue;
      }

      const createdAtMs = s.createdAt ? new Date(s.createdAt as unknown as string).getTime() : 0;
      if (createdAtMs && Date.now() - createdAtMs >= STALE_REMOVAL_MS) {
        await db.update(servers).set({ status: 'removed' }).where(eq(servers.id, s.id));
        removedCount++;
      } else {
        stillPending++;
      }
    }

    return NextResponse.json({ checked: candidates.length, promoted, removed: removedCount, stillPending });
  } catch (error) {
    console.error('[auto-promote] failed', error);
    return NextResponse.json({ error: 'Auto-promote failed.' }, { status: 500 });
  }
}
