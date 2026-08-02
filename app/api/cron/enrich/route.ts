import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { processLogoUpload, LogoValidationError } from '../../../../lib/logoImage';
import {
  descriptionNeedsClean,
  fetchGithubReadme,
  fetchGithubRepo,
  parseGithubUrl,
  pickDescription,
  pickWebsiteUrl,
  resolveInstallFromSignals,
} from '../../../../lib/listingEnrich';
import { cleanListingDescription } from '../../../../lib/description';
import { getGithubToken } from '../../../../lib/githubAuth';

/**
 * Catalog quality pass for scrape/import listings.
 *
 * Per batch (default 40):
 *  - Clean Glama/README chrome in descriptions
 *  - Pull GitHub homepage → website_url, stars, archived/disabled
 *  - Install hints from README
 *  - Owner/org avatar → R2 logo when missing
 *  - Unpublish offline (404) and archived GitHub repos
 *
 * Auth: ADMIN_SECRET. Optional GITHUB_TOKEN greatly raises rate limits.
 * Runs every Worker cron tick (see custom-worker.ts).
 */

const BATCH_SIZE = 40;

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

    // Prefer listings that still look unenriched.
    const candidates = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.status, 'active'),
          or(
            isNull(servers.websiteUrl),
            isNull(servers.logoUrl),
            isNull(servers.installKind),
            isNull(servers.githubStars),
            sql`${servers.description} LIKE '%glama.ai%'`,
            sql`${servers.description} LIKE '[](%'`,
            sql`length(${servers.description}) < 40`
          )
        )
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
      let unpublish = false;

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
            unpublish = true;
          } else if (repoRes.status === 403 || repoRes.status === 429) {
            // Rate limited — stop early to avoid burning the rest of the batch
            await db
              .update(servers)
              .set({ lastCheckedAt: now, description: (updates.description as string | undefined) ?? server.description })
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
            unpublish = true;
          } else {
            healthStatus = 'healthy';
            isVerifiedActive = true;
          }

          description = pickDescription(description, data.description);
          if (description !== server.description) {
            updates.description = description;
            stats.cleanedDesc++;
          }

          const nextWebsite = pickWebsiteUrl(websiteUrl, data.homepage);
          if (nextWebsite && nextWebsite !== websiteUrl) {
            websiteUrl = nextWebsite;
            updates.websiteUrl = websiteUrl;
            // Imported homepage is not yet proven — do not mark verified.
            updates.websiteVerified = false;
            stats.websitesSet++;
          }

          // README → install hints
          const readme = await fetchGithubReadme(gh.owner, gh.repo, githubToken);
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

          // Logo from owner avatar when missing
          if (!logoUrl && data.owner?.avatar_url && env.LOGOS) {
            try {
              const avatarUrl = `${data.owner.avatar_url}${data.owner.avatar_url.includes('?') ? '&' : '?'}s=256`;
              const imgRes = await fetch(avatarUrl, {
                headers: { 'User-Agent': 'AllMCPs-Enricher' },
                signal: AbortSignal.timeout(10000),
              });
              if (imgRes.ok) {
                const buf = await imgRes.arrayBuffer();
                // GitHub avatars are often PNG/JPEG; processLogoUpload validates + re-encodes.
                const png = await processLogoUpload(buf);
                const key = `live/${server.id}.png`;
                await env.LOGOS.put(key, png, {
                  httpMetadata: { contentType: 'image/png' },
                });
                logoUrl = `/logos/${server.id}`;
                updates.logoUrl = logoUrl;
                stats.logosSet++;
              }
            } catch (e) {
              if (!(e instanceof LogoValidationError)) {
                console.error(`Logo enrich failed for ${server.id}:`, e);
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
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
