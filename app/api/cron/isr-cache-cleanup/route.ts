import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isAdminAuthorized } from '../../../../lib/adminAuth';

/**
 * Matches the default prefix baked into @opennextjs/cloudflare's R2 incremental
 * cache adapter (DEFAULT_PREFIX in overrides/internal.js). Keys look like
 * `incremental-cache/<OPEN_NEXT_BUILD_ID>/<hash>.<cacheType>` — every deploy gets
 * a fresh build ID, and the adapter never deletes a previous build's entries
 * (delete() is only reachable via revalidatePath/revalidateTag, which this
 * codebase doesn't call). A bucket-level lifecycle rule expires anything after
 * 7 days as a backstop, but with frequent deploys that still lets multiple
 * builds' worth of orphaned cache pile up in the meantime. This actively purges
 * every prefix except the currently-running build's on each cron tick.
 */
const CACHE_PREFIX = 'incremental-cache/';

export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const currentBuildId = process.env.OPEN_NEXT_BUILD_ID;
    if (!currentBuildId) {
      // Can't tell current from stale without a build ID — do nothing rather
      // than risk deleting the active build's cache.
      return NextResponse.json({ skipped: 'no OPEN_NEXT_BUILD_ID' });
    }

    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }

    const bucket = env.NEXT_INC_CACHE_R2_BUCKET;
    if (!bucket) {
      return NextResponse.json({ skipped: 'no R2 bucket binding' });
    }

    let cursor: string | undefined;
    let scanned = 0;
    let deleted = 0;
    const staleKeys: string[] = [];

    do {
      const page = await bucket.list({ prefix: CACHE_PREFIX, cursor, limit: 1000 });
      for (const obj of page.objects) {
        scanned++;
        const rest = obj.key.slice(CACHE_PREFIX.length);
        const buildId = rest.slice(0, rest.indexOf('/'));
        if (buildId && buildId !== currentBuildId) {
          staleKeys.push(obj.key);
        }
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);

    // R2 bindings cap batch deletes at 1000 keys per call.
    for (let i = 0; i < staleKeys.length; i += 1000) {
      const batch = staleKeys.slice(i, i + 1000);
      await bucket.delete(batch);
      deleted += batch.length;
    }

    return NextResponse.json({ currentBuildId, scanned, deleted });
  } catch (error) {
    console.error('[isr-cache-cleanup] failed', error);
    return NextResponse.json({ error: 'Cleanup failed.' }, { status: 500 });
  }
}
