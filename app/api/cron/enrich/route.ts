import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { listingSignals, servers } from '../../../../db/schema';
import { DEFAULT_SUBMIT_CATEGORY } from '../../../../lib/categories';
import { classifyCategory } from '../../../../lib/categoryClassifier';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import { cronServerColumns } from '../../../../lib/cronServerColumns';
import { cleanListingDescription } from '../../../../lib/description';
import { getGithubToken } from '../../../../lib/githubAuth';
import {
  descriptionNeedsClean,
  extractCandidateImagesFromReadme,
  extractCandidateWebsitesFromReadme,
  extractWebsiteFaviconUrl,
  fetchGithubReadme,
  fetchGithubRepo,
  fetchPackageRegistryMetadata,
  isListingTrulyDead,
  type LogoSource,
  logoSourcePriority,
  parseGithubUrl,
  pickBestWebsiteAndLogo,
  pickDescription,
  pickWebsiteUrl,
  resolveInstallFromSignals,
} from '../../../../lib/listingEnrich';
import {
  listingRenderChanged,
  refreshListingPages,
} from '../../../../lib/listingPageRefresh';
import {
  LogoValidationError,
  processLogoUpload,
} from '../../../../lib/logoImage';
import { upsertSignals } from '../../../../lib/signalStore';

function isGithubUrl(urlString: string): boolean {
  if (!urlString) return false;
  try {
    const parsed = new URL(
      urlString.startsWith('//') ? `https:${urlString}` : urlString,
    );
    return (
      parsed.hostname === 'github.com' ||
      parsed.hostname.endsWith('.github.com')
    );
  } catch {
    return /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*github\.com(?::\d+)?(?:\/|$)/i.test(
      urlString,
    );
  }
}

/**
 * Catalog quality pass for scrape/import listings.
 *
 * Per tick: up to LOGO_BATCH_SIZE logo-less listings plus BATCH_SIZE that still
 * look unenriched, each getting the full pass below, then RECAT_BATCH_SIZE
 * listings still in the default category getting a category check only.
 *  - Clean Glama/README chrome in descriptions
 *  - Pull GitHub homepage & README → website_url (derived or official), stars, archived/disabled
 *  - Install hints from README
 *  - High-quality Logo extraction (README image > Website Favicon > Org Avatar > User Avatar)
 *  - Unpublish offline (404) and archived GitHub repos
 *  - Re-classify the category (Jev, confidence >= 0.75)
 *
 * Auth: CRON_SECRET (see lib/cronAuth.ts). Optional GITHUB_TOKEN greatly raises rate limits.
 * Runs every Worker cron tick (see custom-worker.ts).
 */

// Kept small because each candidate can run several Photon WASM image
// decode/resize/encode passes (README image → favicon → org/user avatar
// cascade); a large batch risks exceeding the Worker's per-request CPU
// budget and getting killed with a bare 503 before any response body is
// written. The Worker's own cron now pings this every 15 min (see
// custom-worker.ts FAST_JOBS), so a smaller batch still drains the backlog
// quickly without the risk.
const BATCH_SIZE = 12;
// Slots reserved each tick for listings still missing a real logo, picked by
// logoCheckedAt rather than lastCheckedAt (which the health cron rewrites every
// ~15 min, so it never reliably surfaced logo-less listings).
const LOGO_BATCH_SIZE = 8;
// Listings stuck on a github_user avatar are re-tried for a better logo at most
// this often, instead of re-entering the queue every tick.
const GITHUB_USER_LOGO_RETRY_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Listings still in DEFAULT_SUBMIT_CATEGORY get a category check every tick,
 * whether or not they look unenriched. That bucket means both "a developer
 * tool" and "we could not tell", and listings with complete metadata never
 * enter the main batch, so without this slot they would never be re-asked.
 * Category check only (one Jev call, no fetches), so it stays cheap.
 */
const RECAT_BATCH_SIZE = 10;
/** A default-category listing Jev answered for is not asked again for this long. */
const RECAT_RECHECK_MS = 60 * 24 * 60 * 60 * 1000;
/** No answer (Jev down or unsure): ask again after this long. */
const RECAT_RETRY_MS = 7 * 24 * 60 * 60 * 1000;

/** Safely writes an asset to R2 without throwing when concurrent jobs write to the same key. */
async function safeR2Put(
  bucket: any,
  key: string,
  value: ArrayBuffer | Uint8Array,
  options?: any,
): Promise<boolean> {
  try {
    await bucket.put(key, value, options);
    return true;
  } catch (e: any) {
    console.warn(`[safeR2Put] R2 put skipped for ${key}: ${e?.message || e}`);
    return false;
  }
}

/** processLogoUpload rejects anything bigger, so never buffer more than this. */
const MAX_LOGO_DOWNLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Reads a response body, giving up once it passes `maxBytes`. README "logo"
 * candidates are often multi-MB GIFs or videos; buffering them whole with
 * arrayBuffer() pushed the jobs Worker over its memory limit.
 */
async function readCappedBody(
  res: Response,
  maxBytes: number,
): Promise<ArrayBuffer | null> {
  const declared = Number(res.headers.get('content-length'));
  if (declared > maxBytes || !res.body) {
    await res.body?.cancel();
    return null;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

async function tryUploadLogo(
  url: string,
  serverId: string,
  envLogos: any,
): Promise<Uint8Array | null> {
  if (!url || !envLogos) return null;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AllMCPs-Enricher/1.0 (+https://allmcps.com)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const buf = await readCappedBody(res, MAX_LOGO_DOWNLOAD_BYTES);
    if (!buf) return null;

    // Reject generic default Google favicons / ultra-tiny placeholder images (< 1000 bytes)
    if (buf.byteLength < 1000) return null;

    return await processLogoUpload(buf);
  } catch (e) {
    if (!(e instanceof LogoValidationError)) {
      console.error(
        `Logo upload processing failed for ${serverId} (${url}):`,
        e,
      );
    }
    return null;
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

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

    // Logo-only queue: missing logo first (never-tried first), then stale
    // github_user avatars that may have gained a better README/site logo.
    const userLogoRetryBefore = new Date(
      Date.now() - GITHUB_USER_LOGO_RETRY_MS,
    );
    const logoBatch = await db
      .select(cronServerColumns)
      .from(servers)
      .where(
        and(
          eq(servers.status, 'active'),
          or(
            isNull(servers.logoUrl),
            isNull(servers.logoSource),
            and(
              eq(servers.logoSource, 'github_user'),
              or(
                isNull(servers.logoCheckedAt),
                lt(servers.logoCheckedAt, userLogoRetryBefore),
              ),
            ),
          ),
        ),
      )
      .orderBy(asc(servers.logoCheckedAt))
      .limit(LOGO_BATCH_SIZE);

    // Prefer listings that still look unenriched.
    const candidates = await db
      .select(cronServerColumns)
      .from(servers)
      .where(
        and(
          eq(servers.status, 'active'),
          or(
            isNull(servers.websiteUrl),
            isNull(servers.logoUrl),
            isNull(servers.logoSource),
            isNull(servers.installKind),
            isNull(servers.githubStars),
            sql`${servers.description} LIKE '%glama.ai%'`,
            sql`${servers.description} LIKE '[](%'`,
            sql`length(${servers.description}) < 40`,
          ),
        ),
      )
      .orderBy(asc(servers.lastCheckedAt))
      .limit(BATCH_SIZE * 2);

    // Fallback: any active ordered by last check if filter is empty/saturated
    const generalBatch =
      candidates.length > 0
        ? candidates.slice(0, BATCH_SIZE)
        : await db
            .select(cronServerColumns)
            .from(servers)
            .where(eq(servers.status, 'active'))
            .orderBy(asc(servers.lastCheckedAt))
            .limit(BATCH_SIZE);
    const logoIds = new Set(logoBatch.map((s) => s.id));
    const batch = [
      ...logoBatch,
      ...generalBatch.filter((s) => !logoIds.has(s.id)),
    ];

    // Listings that lose an earned dofollow website link (website replaced): the
    // cached /mcp/[id] page is regenerated after the batch.
    const pagesToRefresh: string[] = [];

    const stats = {
      processed: 0,
      cleanedDesc: 0,
      websitesSet: 0,
      installSet: 0,
      logosSet: 0,
      unpublished: 0,
      starsSet: 0,
      skipped: 0,
      ghErrors: 0,
      recategorized: 0,
      recatChecked: 0,
    };

    for (const server of batch) {
      const now = new Date();
      const updates: Record<string, unknown> = {
        lastCheckedAt: now,
        logoCheckedAt: now,
      };

      let description = server.description || '';
      let websiteUrl = server.websiteUrl ?? null;
      let healthStatus = server.healthStatus || 'unknown';
      let isVerifiedActive = !!server.isVerifiedActive;
      let githubStars = server.githubStars ?? null;
      let logoUrl = server.logoUrl ?? null;
      let logoSource = (server.logoSource as LogoSource | null) ?? null;
      // Set when the primary GitHub URL is confirmed 404/archived — the actual
      // unpublish decision (below, after this listing's other signals are known)
      // additionally requires the npm/pypi package and remote endpoint to also
      // be dead, so a broken source link alone doesn't take down a listing
      // that's still installable/reachable another way.
      let githubDead = false;

      // Always persist cleaned description when chrome is present (no GH needed).
      if (descriptionNeedsClean(description)) {
        const cleaned = cleanListingDescription(description);
        if (cleaned && cleaned !== description) {
          description = cleaned;
          updates.description = description;
          stats.cleanedDesc++;
        }
      }

      const gh = parseGithubUrl(server.url);
      if (!gh) {
        // Non-GitHub: still write cleaned desc + install from description
        const install = resolveInstallFromSignals({
          id: server.id,
          name: server.name,
          url: server.url,
          description,
          readme: null,
        });
        if (install && !server.installKind) {
          Object.assign(updates, {
            installKind: install.installKind,
            installCommand: install.installCommand,
            installArgs: install.installArgs,
            installPackage: install.installPackage,
            installConfidence: install.installConfidence,
          });
          stats.installSet++;
        }

        const pkgName =
          (updates.installPackage as string | undefined) ||
          server.installPackage;
        if (!websiteUrl && pkgName) {
          const pkgMeta = await fetchPackageRegistryMetadata(pkgName);
          if (pkgMeta?.websiteUrl) {
            websiteUrl = pkgMeta.websiteUrl;
            updates.websiteUrl = websiteUrl;
            // New website domain — the old domain's backlink proof doesn't carry
            // over. The repo README badge is independent, so keep it in the aggregate.
            updates.websiteBacklinkOk = false;
            updates.reciprocalBadgeOk = server.readmeBadgeOk;
            stats.websitesSet++;
          }
        }

        // Try extracting favicon for non-GitHub website URLs if missing logo
        if (!logoUrl && websiteUrl && env.LOGOS) {
          const faviconUrl = await extractWebsiteFaviconUrl(websiteUrl);
          if (faviconUrl) {
            const png = await tryUploadLogo(faviconUrl, server.id, env.LOGOS);
            if (png) {
              const key = `live/${server.id}.png`;
              const putOk = await safeR2Put(env.LOGOS, key, png, {
                httpMetadata: { contentType: 'image/png' },
              });
              if (putOk) {
                logoUrl = `/logos/${server.id}`;
                logoSource = 'website_favicon';
                updates.logoUrl = logoUrl;
                updates.logoSource = logoSource;
                stats.logosSet++;
              }
            }
          }
        }

        updates.isVerifiedActive = isVerifiedActive;
        updates.healthStatus = healthStatus;
        await db.update(servers).set(updates).where(eq(servers.id, server.id));
        if (listingRenderChanged(server, updates))
          pagesToRefresh.push(server.id);
        stats.processed++;
        continue;
      }

      try {
        const repoRes = await fetchGithubRepo(gh.owner, gh.repo, githubToken);
        if (!repoRes.ok) {
          stats.ghErrors++;
          if (repoRes.status === 404) {
            healthStatus = 'offline';
            isVerifiedActive = false;
            githubDead = true;
          } else if (repoRes.status === 403 || repoRes.status === 429) {
            // Rate limited — stop early to avoid burning the rest of the batch
            await db
              .update(servers)
              .set({
                lastCheckedAt: now,
                description:
                  (updates.description as string | undefined) ??
                  server.description,
              })
              .where(eq(servers.id, server.id));
            stats.skipped++;
            break;
          }
        } else {
          const data = repoRes.data;
          if (typeof data.stargazers_count === 'number') {
            githubStars = data.stargazers_count;
            updates.githubStars = githubStars;
            stats.starsSet++;
          }
          if (data.archived || data.disabled) {
            healthStatus = 'archived';
            isVerifiedActive = false;
            githubDead = true;
          } else {
            healthStatus = 'healthy';
            isVerifiedActive = true;
          }

          if (!server.isOfficial) {
            description = pickDescription(description, data.description);
            if (description !== server.description) {
              updates.description = description;
              stats.cleanedDesc++;
            }
          }

          const nextWebsite = pickWebsiteUrl(websiteUrl, data.homepage);
          if (nextWebsite && nextWebsite !== websiteUrl) {
            websiteUrl = nextWebsite;
            updates.websiteUrl = websiteUrl;
            // New website domain — reset the website backlink, keep the repo README badge.
            updates.websiteBacklinkOk = false;
            updates.reciprocalBadgeOk = server.readmeBadgeOk;
            stats.websitesSet++;
          }

          // README → website, logo, install hints
          const readme = await fetchGithubReadme(
            gh.owner,
            gh.repo,
            githubToken,
          );

          if (readme) {
            const candidateWebsites = extractCandidateWebsitesFromReadme(
              readme,
              gh.owner,
              gh.repo,
            );
            const candidateImages = extractCandidateImagesFromReadme(
              readme,
              gh.owner,
              gh.repo,
            );

            let llmChoice: { websiteUrl?: string; logoUrl?: string } | null =
              null;
            if (candidateWebsites.length > 0 || candidateImages.length > 0) {
              llmChoice = await pickBestWebsiteAndLogo({
                readmeSnippet: readme,
                ghOwner: gh.owner,
                ghRepo: gh.repo,
                candidateUrls: candidateWebsites,
                candidateImages: candidateImages,
              });
            }

            // Derive website from README if current is missing or points to github.com
            const derivedWebsite =
              llmChoice?.websiteUrl || candidateWebsites[0];
            if (derivedWebsite && (!websiteUrl || isGithubUrl(websiteUrl))) {
              websiteUrl = derivedWebsite;
              updates.websiteUrl = websiteUrl;
              // New website domain — reset the website backlink, keep the repo README badge.
              updates.websiteBacklinkOk = false;
              updates.reciprocalBadgeOk = server.readmeBadgeOk;
              stats.websitesSet++;
            }

            const install = resolveInstallFromSignals({
              id: server.id,
              name: server.name,
              url: server.url,
              description,
              readme,
            });
            if (install) {
              Object.assign(updates, {
                installKind: install.installKind,
                installCommand: install.installCommand,
                installArgs: install.installArgs,
                installPackage: install.installPackage,
                installConfidence: install.installConfidence,
              });
              stats.installSet++;
            }

            // Logo Resolution: Enforce Priority Hierarchy
            const currentPriority = logoSourcePriority(logoSource);

            if (currentPriority < 5 && env.LOGOS) {
              // Priority 4: README Logo
              if (currentPriority < 4) {
                const llmLogoUrl = llmChoice?.logoUrl;
                const readmeLogoCandidates = llmLogoUrl
                  ? [
                      llmLogoUrl,
                      ...candidateImages.filter((img) => img !== llmLogoUrl),
                    ]
                  : candidateImages;

                for (const candidate of readmeLogoCandidates) {
                  const png = await tryUploadLogo(
                    candidate,
                    server.id,
                    env.LOGOS,
                  );
                  if (png) {
                    const key = `live/${server.id}.png`;
                    const putOk = await safeR2Put(env.LOGOS, key, png, {
                      httpMetadata: { contentType: 'image/png' },
                    });
                    if (putOk) {
                      logoUrl = `/logos/${server.id}`;
                      logoSource = 'readme';
                      updates.logoUrl = logoUrl;
                      updates.logoSource = logoSource;
                      stats.logosSet++;
                    }
                    break;
                  }
                }
              }
            }
          }

          // Priority 3: Website Favicon / Icon
          const currentPriorityAfterReadme = logoSourcePriority(logoSource);
          if (currentPriorityAfterReadme < 3 && websiteUrl && env.LOGOS) {
            const faviconUrl = await extractWebsiteFaviconUrl(websiteUrl);
            if (faviconUrl) {
              const png = await tryUploadLogo(faviconUrl, server.id, env.LOGOS);
              if (png) {
                const key = `live/${server.id}.png`;
                const putOk = await safeR2Put(env.LOGOS, key, png, {
                  httpMetadata: { contentType: 'image/png' },
                });
                if (putOk) {
                  logoUrl = `/logos/${server.id}`;
                  logoSource = 'website_favicon';
                  updates.logoUrl = logoUrl;
                  updates.logoSource = logoSource;
                  stats.logosSet++;
                }
              }
            }
          }

          // Priority 2: GitHub Org avatar
          const currentPriorityAfterWebsite = logoSourcePriority(logoSource);
          if (
            currentPriorityAfterWebsite < 2 &&
            data.owner?.type === 'Organization' &&
            data.owner?.avatar_url &&
            env.LOGOS
          ) {
            const avatarUrl = `${data.owner.avatar_url}${data.owner.avatar_url.includes('?') ? '&' : '?'}s=256`;
            const png = await tryUploadLogo(avatarUrl, server.id, env.LOGOS);
            if (png) {
              const key = `live/${server.id}.png`;
              const putOk = await safeR2Put(env.LOGOS, key, png, {
                httpMetadata: { contentType: 'image/png' },
              });
              if (putOk) {
                logoUrl = `/logos/${server.id}`;
                logoSource = 'github_org';
                updates.logoUrl = logoUrl;
                updates.logoSource = logoSource;
                stats.logosSet++;
              }
            }
          }

          // Priority 1: GitHub User avatar (lowest fallback)
          if (
            !logoUrl &&
            data.owner?.type === 'User' &&
            data.owner?.avatar_url &&
            env.LOGOS
          ) {
            const avatarUrl = `${data.owner.avatar_url}${data.owner.avatar_url.includes('?') ? '&' : '?'}s=256`;
            const png = await tryUploadLogo(avatarUrl, server.id, env.LOGOS);
            if (png) {
              const key = `live/${server.id}.png`;
              const putOk = await safeR2Put(env.LOGOS, key, png, {
                httpMetadata: { contentType: 'image/png' },
              });
              if (putOk) {
                logoUrl = `/logos/${server.id}`;
                logoSource = 'github_user';
                updates.logoUrl = logoUrl;
                updates.logoSource = logoSource;
                stats.logosSet++;
              }
            }
          }
        }
      } catch (e) {
        console.error(`Enrich failed for ${server.id}:`, e);
        stats.ghErrors++;
      }

      updates.healthStatus = healthStatus;
      updates.isVerifiedActive = isVerifiedActive;
      if (githubStars != null) updates.githubStars = githubStars;

      const unpublish = githubDead
        ? await isListingTrulyDead({
            githubDead,
            remoteEndpointHealthy: server.remoteEndpointHealthy,
            installCommand:
              (updates.installCommand as string | undefined) ??
              server.installCommand,
            installPackage:
              (updates.installPackage as string | undefined) ??
              server.installPackage,
          })
        : false;

      if (unpublish) {
        updates.status = 'removed';
        stats.unpublished++;
      }

      // Category is re-derived here because the original assignment came from a
      // first-match-wins regex whose miss falls through to "Developer Tools",
      // leaving that bucket meaning both "is a developer tool" and "we could not
      // tell". classifyCategory returns the current value unchanged whenever Jev
      // is unconfigured, errors, or is not confident enough, so this can only
      // move a listing to a category something was actually sure about.
      const classified = await classifyCategory(
        {
          name: (updates.name as string | undefined) ?? server.name,
          description:
            (updates.description as string | undefined) ?? server.description,
          url: server.url,
        },
        server.category,
      );
      if (classified.fromJev && classified.category !== server.category) {
        updates.category = classified.category;
        stats.recategorized++;
      }

      await db.update(servers).set(updates).where(eq(servers.id, server.id));
      if (listingRenderChanged(server, updates)) pagesToRefresh.push(server.id);
      stats.processed++;
    }

    // Default-category slot, with its own cursor (listing_signals.
    // category_checked_at): a listing is re-asked only when never checked or
    // checked more than RECAT_RECHECK_MS ago, so one Jev confirms really is
    // Developer Tools is not asked again every few days.
    const batchIds = new Set(batch.map((s) => s.id));
    const recatCutoff = new Date(Date.now() - RECAT_RECHECK_MS);
    const recatRows = await db
      .select({
        id: servers.id,
        name: servers.name,
        description: servers.description,
        url: servers.url,
        category: servers.category,
      })
      .from(servers)
      .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
      .where(
        and(
          eq(servers.status, 'active'),
          isNull(servers.staleFlaggedAt),
          eq(servers.category, DEFAULT_SUBMIT_CATEGORY),
          or(
            isNull(listingSignals.categoryCheckedAt),
            lt(listingSignals.categoryCheckedAt, recatCutoff),
          ),
        ),
      )
      .orderBy(asc(listingSignals.categoryCheckedAt))
      .limit(RECAT_BATCH_SIZE + batch.length);
    for (const row of recatRows
      .filter((r) => !batchIds.has(r.id))
      .slice(0, RECAT_BATCH_SIZE)) {
      const classified = await classifyCategory(row, row.category);
      const now = Date.now();
      // An answer (move or "it really is the default") holds for the full
      // window; no answer (Jev down or unsure) comes back in a week.
      const checkedAt = new Date(
        classified.fromJev ? now : now - RECAT_RECHECK_MS + RECAT_RETRY_MS,
      );
      await upsertSignals(db, row.id, { categoryCheckedAt: checkedAt });
      if (classified.fromJev && classified.category !== row.category) {
        await db
          .update(servers)
          .set({ category: classified.category })
          .where(eq(servers.id, row.id));
        stats.recategorized++;
        pagesToRefresh.push(row.id);
      }
      stats.recatChecked++;
    }

    const pages = await refreshListingPages(pagesToRefresh, env);

    return NextResponse.json({
      success: true,
      ...stats,
      batchSize: batch.length,
      githubAuth: Boolean(githubToken),
      pagesRefreshed: pages.refreshed.length,
      pageRefreshFailed: pages.failed,
      message: `Enriched ${stats.processed} listings (websites ${stats.websitesSet}, logos ${stats.logosSet}, install ${stats.installSet}, recategorized ${stats.recategorized} (${stats.recatChecked} default-category checks), unpublished ${stats.unpublished}).`,
    });
  } catch (error: any) {
    // Drizzle's message is "Failed query: <sql>"; the D1 reason is on `cause`.
    const reason = String(
      error?.cause?.message ?? error?.message ?? 'Internal Server Error',
    );
    console.error('Enrich cron error:', reason, error);
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
