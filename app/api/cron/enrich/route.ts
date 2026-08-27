import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
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
  pickBestWebsiteAndLogoWithLlm,
  pickDescription,
  pickWebsiteUrl,
  resolveInstallFromSignals,
} from '../../../../lib/listingEnrich';
import {
  LogoValidationError,
  processLogoUpload,
} from '../../../../lib/logoImage';

/**
 * Catalog quality pass for scrape/import listings.
 *
 * Per batch (default 40):
 *  - Clean Glama/README chrome in descriptions
 *  - Pull GitHub homepage & README → website_url (derived or official), stars, archived/disabled
 *  - Install hints from README
 *  - High-quality Logo extraction (README image > Website Favicon > Org Avatar > User Avatar)
 *  - Unpublish offline (404) and archived GitHub repos
 *
 * Auth: ADMIN_SECRET. Optional GITHUB_TOKEN greatly raises rate limits.
 * Runs every Worker cron tick (see custom-worker.ts).
 */

// Kept small because each candidate can run several Photon WASM image
// decode/resize/encode passes (README image → favicon → org/user avatar
// cascade); a large batch risks exceeding the Worker's per-request CPU
// budget and getting killed with a bare 503 before any response body is
// written. The Worker's own cron now pings this every 15 min (see
// custom-worker.ts FAST_JOBS), so a smaller batch still drains the backlog
// quickly without the risk.
const BATCH_SIZE = 15;

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
    const buf = await res.arrayBuffer();

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
    if (!(await isAdminAuthorized(req))) {
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

    // Prefer listings that still look unenriched or have lower-quality avatars (github_user).
    const candidates = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.status, 'active'),
          or(
            isNull(servers.websiteUrl),
            isNull(servers.logoUrl),
            isNull(servers.logoSource),
            eq(servers.logoSource, 'github_user'),
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
    const batch =
      candidates.length > 0
        ? candidates.slice(0, BATCH_SIZE)
        : await db
            .select()
            .from(servers)
            .where(eq(servers.status, 'active'))
            .orderBy(asc(servers.lastCheckedAt))
            .limit(BATCH_SIZE);

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
    };

    for (const server of batch) {
      const now = new Date();
      const updates: Record<string, unknown> = {
        lastCheckedAt: now,
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
              llmChoice = await pickBestWebsiteAndLogoWithLlm({
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
            if (
              derivedWebsite &&
              (!websiteUrl || /github\.com/i.test(websiteUrl))
            ) {
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
                const readmeLogoCandidates = llmChoice?.logoUrl
                  ? [
                      llmChoice.logoUrl,
                      ...candidateImages.filter(
                        (img) => img !== llmChoice!.logoUrl,
                      ),
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

      await db.update(servers).set(updates).where(eq(servers.id, server.id));
      stats.processed++;
    }

    return NextResponse.json({
      success: true,
      ...stats,
      batchSize: batch.length,
      githubAuth: Boolean(githubToken),
      message: `Enriched ${stats.processed} listings (websites ${stats.websitesSet}, logos ${stats.logosSet}, install ${stats.installSet}, unpublished ${stats.unpublished}).`,
    });
  } catch (error: any) {
    console.error('Enrich cron error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
