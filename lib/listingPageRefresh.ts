import { getCloudflareContext } from '@opennextjs/cloudflare';
import { type RoleEnv, workerRole } from './cronSchedule';

/**
 * Explicit ISR refresh for /mcp/[id] after a write that changes what the page
 * renders (dofollow/nofollow, official, premium, unpublished).
 *
 * Background ISR only regenerates a page when a visitor hits it after its
 * revalidate window, so a low-traffic listing can keep serving an old render
 * long after its row changed. A listing whose badge was verified kept
 * rel="nofollow" on its website link for days that way (2026-10). This sends
 * the same request OpenNext's memory queue uses for background revalidation
 * (HEAD + x-prerender-revalidate + x-isr), but right after the write.
 *
 * The request has to reach the Worker that serves pages:
 * - site Worker: WORKER_SELF_REFERENCE (points at itself).
 * - jobs Worker: SITE. Its own WORKER_SELF_REFERENCE points at all-mcps-jobs,
 *   which is not the Worker visitors hit.
 * Both Workers ship from the same build, so NEXT_PREVIEW_MODE_ID matches.
 */

export const SITE_ORIGIN = 'https://allmcps.com';
const REFRESH_TIMEOUT_MS = 15_000;

type PageRefreshEnv = RoleEnv & {
  SITE?: Fetcher;
  WORKER_SELF_REFERENCE?: Fetcher;
};

export function listingPagePath(id: string): string {
  return `/mcp/${encodeURIComponent(id)}`;
}

/**
 * Whether a cron write changed what the listing page renders: the website
 * link's dofollow status flipped, or the listing was unpublished.
 */
export function listingRenderChanged(
  before: { websiteBacklinkOk: boolean | null },
  after: { websiteBacklinkOk?: unknown; status?: unknown },
): boolean {
  if (after.status === 'removed') return true;
  if (typeof after.websiteBacklinkOk !== 'boolean') return false;
  return after.websiteBacklinkOk !== Boolean(before.websiteBacklinkOk);
}

/** The binding that reaches the page-serving Worker, or null if this Worker has none. */
export function pageServingFetcher(env: unknown): Fetcher | null {
  const e = (env ?? {}) as PageRefreshEnv;
  if (workerRole(env) === 'jobs') return e.SITE ?? null;
  return e.WORKER_SELF_REFERENCE ?? null;
}

/**
 * Regenerates one page in the ISR cache. Resolves true only when Next reports
 * the page was re-rendered (x-nextjs-cache: REVALIDATED). Never throws.
 */
export async function refreshPage(
  path: string,
  env: unknown,
  previewModeId: string | undefined = process.env.NEXT_PREVIEW_MODE_ID,
): Promise<boolean> {
  const fetcher = pageServingFetcher(env);
  if (!fetcher || !previewModeId) {
    console.error(
      `[page-refresh] cannot refresh ${path}: ${fetcher ? 'NEXT_PREVIEW_MODE_ID unset' : 'no binding to the site Worker'}`,
    );
    return false;
  }
  let response: Response | undefined;
  try {
    response = await fetcher.fetch(`${SITE_ORIGIN}${path}`, {
      method: 'HEAD',
      headers: { 'x-prerender-revalidate': previewModeId, 'x-isr': '1' },
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    const cache = response.headers.get('x-nextjs-cache');
    if (response.status === 200 && cache === 'REVALIDATED') return true;
    console.error(
      `[page-refresh] ${path} not regenerated (status ${response.status}, x-nextjs-cache ${cache})`,
    );
    return false;
  } catch (error) {
    console.error(`[page-refresh] ${path} threw`, error);
    return false;
  } finally {
    try {
      await response?.body?.cancel();
    } catch {
      // Already consumed.
    }
  }
}

/** Refreshes each listing page once, sequentially. Never throws. */
export async function refreshListingPages(
  ids: Iterable<string>,
  env: unknown,
): Promise<{ refreshed: string[]; failed: string[] }> {
  const refreshed: string[] = [];
  const failed: string[] = [];
  for (const id of new Set(ids)) {
    if (await refreshPage(listingPagePath(id), env)) refreshed.push(id);
    else failed.push(id);
  }
  return { refreshed, failed };
}

/**
 * For request handlers: refreshes the listing page after the response is sent
 * (waitUntil), so the caller never waits on a page render. Never throws.
 */
export function refreshListingPageInBackground(id: string): void {
  try {
    const { env, ctx } = getCloudflareContext();
    const task = refreshListingPages([id], env);
    if (ctx?.waitUntil) ctx.waitUntil(task);
  } catch (error) {
    console.error(`[page-refresh] could not schedule /mcp/${id}`, error);
  }
}
