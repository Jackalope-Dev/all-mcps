import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, eq, isNotNull, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '../../../../db/schema';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import {
  listingPagePath,
  pageServingFetcher,
  refreshPage,
  SITE_ORIGIN,
} from '../../../../lib/listingPageRefresh';
import {
  auditListingPageRel,
  type RelAuditListing,
} from '../../../../lib/listingRelAudit';

/**
 * Backstop for lib/listingPageRefresh.ts. Loads the /mcp/[id] page visitors
 * and crawlers are actually served for every active listing that should have
 * a dofollow website link (premium, or a verified website badge), and
 * regenerates any whose cached render disagrees with the database. Catches
 * whatever the write-time refresh missed, and logs it so the miss is visible.
 */

/** Far above the ~30 eligible listings today; keeps a runaway bounded. */
const MAX_LISTINGS = 300;

async function servedHtml(
  fetcher: Fetcher,
  id: string,
): Promise<string | null> {
  try {
    const res = await fetcher.fetch(`${SITE_ORIGIN}${listingPagePath(id)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      await res.body?.cancel();
      return null;
    }
    return await res.text();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { env } = await getCloudflareContext();
    if (!env?.DB) throw new Error('Database binding not found');
    const fetcher = pageServingFetcher(env);
    if (!fetcher) {
      return NextResponse.json({ skipped: 'no binding to the site Worker' });
    }

    const db = drizzle(env.DB);
    const rows = await db
      .select({
        id: servers.id,
        websiteUrl: servers.websiteUrl,
        isPremium: servers.isPremium,
        websiteBacklinkOk: servers.websiteBacklinkOk,
      })
      .from(servers)
      .where(
        and(
          eq(servers.status, 'active'),
          isNotNull(servers.websiteUrl),
          or(eq(servers.isPremium, true), eq(servers.websiteBacklinkOk, true)),
        ),
      )
      .limit(MAX_LISTINGS);

    const drifted: string[] = [];
    const repaired: string[] = [];
    const stillWrong: string[] = [];
    const unreadable: string[] = [];

    for (const row of rows) {
      if (!row.websiteUrl) continue;
      const listing: RelAuditListing = { ...row, websiteUrl: row.websiteUrl };
      const html = await servedHtml(fetcher, row.id);
      if (html === null) {
        unreadable.push(row.id);
        continue;
      }
      const audit = auditListingPageRel(html, listing);
      if (audit.ok) continue;

      drifted.push(row.id);
      console.error(
        `[listing-rel-audit] /mcp/${row.id} served ${audit.reason} (rels: ${audit.rels.join(' | ') || 'none'}); regenerating`,
      );
      await refreshPage(listingPagePath(row.id), env);
      const after = await servedHtml(fetcher, row.id);
      if (after !== null && auditListingPageRel(after, listing).ok) {
        repaired.push(row.id);
      } else {
        stillWrong.push(row.id);
      }
    }

    if (stillWrong.length > 0) {
      console.error(
        `[listing-rel-audit] still wrong after regeneration: ${stillWrong.join(', ')}`,
      );
    }

    return NextResponse.json({
      success: true,
      checked: rows.length,
      drifted,
      repaired,
      stillWrong,
      unreadable,
      message: `Checked ${rows.length} dofollow listings: ${drifted.length} stale, ${repaired.length} repaired, ${stillWrong.length} still wrong, ${unreadable.length} unreadable.`,
    });
  } catch (error) {
    console.error('Listing rel audit error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
