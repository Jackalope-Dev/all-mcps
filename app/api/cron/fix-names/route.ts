import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, eq, gt } from 'drizzle-orm';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import {
  deriveServerName,
  fetchGithubReadme,
  isGenericServerName,
  parseGithubUrl,
} from '../../../../lib/listingEnrich';
import { getGithubToken } from '../../../../lib/githubAuth';

/**
 * One-off backlog cleanup for listings whose `name` is a bare technical label
 * ("mcp", "mcp-server", "reference-data", ...) left over from scrape imports
 * that used a package/repo slug instead of a real title — see
 * lib/listingEnrich.ts#deriveServerName. Not a recurring cron: once the
 * backlog clears there's nothing left for it to do, so it isn't wired into
 * custom-worker.ts. Re-run scripts/backfill-server-names.mjs if a future bulk
 * import reintroduces generic names.
 *
 * Paginates by `id` (no dedicated cursor column) so repeated calls scan
 * forward through the whole catalog; each call both scans a page (to find
 * candidates) and fixes a bounded number of them (to stay inside the Worker's
 * CPU/time budget, since each fix needs a GitHub repo + README fetch).
 *
 * Auth: ADMIN_SECRET. Optional GITHUB_TOKEN raises rate limits.
 */

const SCAN_PAGE_SIZE = 300;
const FIX_LIMIT = 15;

export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after') || '';
    const dryRun = searchParams.get('dryRun') === '1';

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }
    if (!env?.DB) throw new Error('Database binding not found');

    const db = drizzle(env.DB as any);
    const githubToken = getGithubToken(env);

    const page = await db
      .select({
        id: servers.id,
        name: servers.name,
        url: servers.url,
        isOfficial: servers.isOfficial,
      })
      .from(servers)
      .where(and(eq(servers.status, 'active'), gt(servers.id, after)))
      .orderBy(asc(servers.id))
      .limit(SCAN_PAGE_SIZE);

    const candidates = page.filter((r) => !r.isOfficial && isGenericServerName(r.name));
    const toFix = candidates.slice(0, FIX_LIMIT);

    const results: { id: string; oldName: string; newName: string }[] = [];
    let ghErrors = 0;

    for (const row of toFix) {
      const gh = parseGithubUrl(row.url);
      let readme: string | null = null;

      if (gh) {
        try {
          readme = await fetchGithubReadme(gh.owner, gh.repo, githubToken);
        } catch {
          ghErrors++;
        }
      }

      const newName = deriveServerName({ currentName: row.name, url: row.url, ghRepo: gh, readme });
      if (!newName || newName === row.name) continue;

      results.push({ id: row.id, oldName: row.name, newName });
      if (!dryRun) {
        await db.update(servers).set({ name: newName }).where(eq(servers.id, row.id));
      }
    }

    const nextCursor = page.length > 0 ? page[page.length - 1].id : after;
    const done = page.length < SCAN_PAGE_SIZE;

    return NextResponse.json({
      success: true,
      dryRun,
      scanned: page.length,
      genericFound: candidates.length,
      fixed: dryRun ? 0 : results.length,
      proposed: dryRun ? results.length : undefined,
      results,
      ghErrors,
      nextCursor,
      done,
      message: `${dryRun ? 'Would fix' : 'Fixed'} ${results.length}/${candidates.length} generic names in this page (${page.length} scanned).`,
    });
  } catch (error: any) {
    console.error('Fix-names cron error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
