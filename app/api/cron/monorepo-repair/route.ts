import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { jobCursors } from '../../../../db/schema';
import { isCronAuthorized } from '../../../../lib/cronAuth';

/**
 * One-time repair for listings that deep-link into a monorepo folder
 * (github.com/o/r/tree/<ref>/<path>). Until Oct 2026 every README reader used
 * the repo root's README, so these listings took their install command, tool
 * list and writeup from the wrong project: Filesystem, Time, Fetch and
 * Sequential Thinking all carried `npx @modelcontextprotocol/server-memory`,
 * and the sandbox then "verified" the Memory server's tools for them.
 *
 * README readers now use the folder (lib/listingEnrich.ts fetchGithubReadme).
 * This clears what was derived from the wrong README so the existing crons
 * rebuild it: the ai-content install pass re-extracts install (it claims rows
 * with no installExtractedAt), the stdio verifier re-tests the new command,
 * the health cron re-reads the README (no readmeHash), and content_changed_at
 * queues a fresh writeup (which also re-tags the listing).
 *
 * Runs once: the job_cursors row marks it done, so later calls no-op.
 * Trigger it from the Backfill workflow (job: monorepo-repair).
 */

const DONE_MARKER = 'monorepo-repair:v1';

/** Active listings whose URL deep-links into a GitHub repo folder. */
const MATCH = `status = 'active' AND (url LIKE 'https://github.com/%/%/tree/%/%' OR url LIKE 'https://github.com/%/%/blob/%/%')`;

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { env } = await getCloudflareContext({ async: true });
    const d1 = (env as any)?.DB;
    if (!d1) throw new Error('Database binding not found');
    const db = drizzle(d1);

    const [done] = await db
      .select({ value: jobCursors.value })
      .from(jobCursors)
      .where(eq(jobCursors.name, DONE_MARKER))
      .limit(1);
    if (done) {
      return NextResponse.json({
        alreadyDone: done.value,
        processed: 0,
        remaining: 0,
      });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const [{ n }] = (
      await d1.prepare(`SELECT count(*) AS n FROM servers WHERE ${MATCH}`).all()
    ).results as { n: number }[];

    await d1.batch([
      // Install, tools and verified-run evidence all came from the wrong
      // project. installExtractedAt NULL puts the row back in the install pass.
      d1.prepare(
        `UPDATE servers SET install_kind = NULL, install_command = NULL, install_args = NULL,
           install_package = NULL, install_confidence = NULL, install_extracted_at = NULL,
           install_needs_config = NULL, tools = NULL, tools_source = NULL,
           tools_checked_at = NULL, tools_error = NULL
         WHERE ${MATCH}`,
      ),
      // The sandbox result was for the wrong package; the verifier re-tests
      // once install is re-extracted.
      d1.prepare(
        `DELETE FROM stdio_verifications WHERE server_id IN (SELECT id FROM servers WHERE ${MATCH})`,
      ),
      // Re-read the README, drop the security profile built from the wrong
      // tools, and queue a fresh writeup.
      d1
        .prepare(
          `INSERT INTO listing_signals (server_id, content_changed_at, content_refresh_failures)
           SELECT id, ?1, 0 FROM servers WHERE ${MATCH}
           ON CONFLICT(server_id) DO UPDATE SET
             content_changed_at = ?1, content_refresh_failures = 0,
             content_refresh_failed_at = NULL, readme_hash = NULL,
             security_profile = NULL, package_repo = NULL`,
        )
        .bind(nowSec),
      d1
        .prepare(
          `INSERT INTO job_cursors (name, value, updated_at) VALUES (?1, ?2, ?3)`,
        )
        .bind(DONE_MARKER, `repaired ${n} listings`, nowSec),
    ]);

    return NextResponse.json({ processed: Number(n), remaining: 0 });
  } catch (e: any) {
    console.error('[monorepo-repair] failed:', e);
    return NextResponse.json(
      { error: e?.message || 'monorepo-repair failed' },
      { status: 500 },
    );
  }
}
