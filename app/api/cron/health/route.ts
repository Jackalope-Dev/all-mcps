import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers, serverHealthChecks } from '../../../../db/schema';
import { eq, asc, desc, and, notInArray } from 'drizzle-orm';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { isSafeFetchTarget } from '../../../../lib/urlSafety';
import { websiteHasReciprocalBadge } from '../../../../lib/verification';
import { callMcpEndpoint } from '../../../../lib/mcpIntrospect';
import { parseToolsFromReadme } from '../../../../lib/tools/parseToolsFromReadme';
import {
  resolveInstallFromText,
  resolveInstallConfig,
  toCachedInstallFields,
} from '../../../../lib/installConfig';
import { getGithubToken, githubApiHeaders } from '../../../../lib/githubAuth';

/**
 * Best-effort npm last-month downloads for a package name. Returns null if not on npm.
 *
 * Guards against a degenerate-name quirk in npm's API: querying a name that isn't a real
 * package (e.g. "." from a misparsed "pip install ." dev instruction) can return HTTP 200
 * with a registry-wide aggregate instead of a 404 — observed as 674 billion "downloads"
 * for a single listing. A valid per-package response always echoes the queried name back
 * in `package`; the aggregate response omits it, so checking that field rejects it. The
 * ceiling below is a second backstop against any other npm response shape carrying an
 * implausible count — no real single package sees anywhere near that volume.
 */
async function fetchNpmDownloads(pkg: string): Promise<number | null> {
  const name = pkg.trim();
  if (!name || /^[.\-_]+$/.test(name) || /\s/.test(name) || name.includes('://')) return null;
  try {
    const res = await fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`, {
      headers: { 'User-Agent': 'AllMCPs-Health-Checker' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { downloads?: number; package?: string };
    if (typeof data.downloads !== 'number' || data.package !== name) return null;
    // No real single npm package has ever cleared ~1B monthly downloads.
    if (data.downloads > 1_000_000_000) return null;
    return data.downloads;
  } catch {
    return null;
  }
}

async function fetchGithubReadme(owner: string, repo: string): Promise<string | null> {
  for (const branch of ['main', 'master']) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`,
        {
          headers: { 'User-Agent': 'AllMCPs-Health-Checker' },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.ok) return await res.text();
    } catch {
      /* try next branch */
    }
  }
  return null;
}

// Maximum servers to check per cron run (keeps us under rate limits)
const BATCH_SIZE = 50;
/** Prefer rechecking popular listings at least this often. */
const POPULAR_STALE_MS = 3 * 24 * 60 * 60 * 1000;
/**
 * Bounds server_health_checks per listing — see db/schema.ts for why. The
 * cron runs every 15min (.github/workflows/health-check.yml), so 96 covers a
 * full day of history — enough to actually show a trend, not just the last
 * few hours.
 */
const HEALTH_HISTORY_LIMIT = 96;

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

    if (!env || !env.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);
    const githubToken = getGithubToken(env);

    // Mix oldest-checked (coverage) with popular-stale (user-facing quality).
    const half = Math.floor(BATCH_SIZE / 2);
    const [oldest, popular] = await Promise.all([
      db
        .select()
        .from(servers)
        .where(eq(servers.status, 'active'))
        .orderBy(asc(servers.lastCheckedAt))
        .limit(half),
      db
        .select()
        .from(servers)
        .where(eq(servers.status, 'active'))
        .orderBy(desc(servers.views), desc(servers.upvotes), desc(servers.copies))
        .limit(half * 2),
    ]);

    const staleCutoff = Date.now() - POPULAR_STALE_MS;
    const seen = new Set<string>();
    const batch: typeof oldest = [];

    // First: popular listings that are stale or never checked / missing stars
    for (const s of popular) {
      if (batch.length >= half) break;
      const checked = s.lastCheckedAt ? new Date(s.lastCheckedAt as any).getTime() : 0;
      const needs =
        !checked ||
        checked < staleCutoff ||
        s.githubStars == null ||
        !s.installKind;
      if (!needs) continue;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      batch.push(s);
    }

    // Fill remainder with oldest-checked for full-catalog coverage
    for (const s of oldest) {
      if (batch.length >= BATCH_SIZE) break;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      batch.push(s);
    }

    // If still short, take more popular regardless of staleness
    for (const s of popular) {
      if (batch.length >= BATCH_SIZE) break;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      batch.push(s);
    }

    if (batch.length === 0) {
      return NextResponse.json({ success: true, message: 'No active servers to check.' });
    }

    let processed = 0;
    let installHintsUpdated = 0;
    let unpublished = 0;

    for (const server of batch) {
      const now = new Date();
      let isVerifiedActive = false;
      let healthStatus = 'unknown';
      let reciprocalBadgeOk = server.reciprocalBadgeOk;
      let githubStars: number | null = server.githubStars ?? null;
      let toolsJson: string | null = server.tools ?? null;
      let toolsCheckedAt: Date | null = server.toolsCheckedAt ?? null;
      let toolsError: string | null = server.toolsError ?? null;
      let toolsSource: string | null = server.toolsSource ?? null;
      let lastCommitAt: Date | null = server.lastCommitAt ?? null;
      let remoteEndpointHealthy: boolean | null = server.remoteEndpointHealthy ?? null;
      let remoteEndpointCheckedAt: Date | null = server.remoteEndpointCheckedAt ?? null;

      // Prefer package name from cached install, else listing name
      const npmName = server.installPackage || server.name;
      const npmDownloads = await fetchNpmDownloads(npmName);

      let readmeText: string | null = null;

      try {
        if (server.url.includes('github.com')) {
          const githubMatch = server.url.match(/github\.com\/([^/]+)\/([^/]+)/);
          if (githubMatch) {
            const owner = githubMatch[1];
            let repo = githubMatch[2];
            if (repo.endsWith('.git')) repo = repo.slice(0, -4);

            const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
              headers: githubApiHeaders(githubToken, 'application/vnd.github+json', 'AllMCPs-Health-Checker'),
              signal: AbortSignal.timeout(10000),
            });

            if (ghRes.ok) {
              const ghData = (await ghRes.json()) as any;
              if (typeof ghData.stargazers_count === 'number') {
                githubStars = ghData.stargazers_count;
              }
              if (typeof ghData.pushed_at === 'string') {
                const pushed = new Date(ghData.pushed_at);
                if (!Number.isNaN(pushed.getTime())) lastCommitAt = pushed;
              }
              if (ghData.archived || ghData.disabled) {
                healthStatus = 'archived';
              } else {
                isVerifiedActive = true;
                healthStatus = 'healthy';
              }

              readmeText = await fetchGithubReadme(owner, repo);
              if (readmeText) {
                reciprocalBadgeOk = websiteHasReciprocalBadge(readmeText, server.id);
              }

              // GitHub-linked listings are almost always stdio packages (npx/uvx/pip), not a
              // live HTTP endpoint, so the tools/list handshake below never applies to them —
              // this is the only source of tool data they'll ever get. Never overwrite a real
              // live-introspected result with a weaker guess (moot in practice: a listing's
              // URL shape doesn't change between runs, so the branches never collide on one
              // listing, but this keeps the intent explicit).
              if (readmeText && toolsSource !== 'introspected') {
                toolsCheckedAt = now;
                const parsedTools = parseToolsFromReadme(readmeText);
                if (parsedTools.length > 0) {
                  toolsJson = JSON.stringify(parsedTools);
                  toolsSource = 'readme';
                  toolsError = null;
                } else {
                  // Leave any previously-found tools/source alone — this only means
                  // *this run's* README didn't parse, not that earlier good data is stale.
                  toolsError = 'No tools section found in README.';
                }
              }
            } else if (ghRes.status === 404) {
              healthStatus = 'offline';
            }
          }
        } else if (!isSafeFetchTarget(server.url)) {
          healthStatus = 'offline';
        } else {
          const pingRes = await fetch(server.url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(8000),
          }).catch(() => null);
          if (pingRes && pingRes.status < 500) {
            isVerifiedActive = true;
            healthStatus = 'healthy';
          } else {
            const getRes = await fetch(server.url, {
              method: 'GET',
              signal: AbortSignal.timeout(8000),
            }).catch(() => null);
            if (getRes && getRes.status < 500) {
              isVerifiedActive = true;
              healthStatus = 'healthy';
            } else {
              healthStatus = 'offline';
            }
          }

          if (isVerifiedActive) {
            const introspection = await callMcpEndpoint(server.url, { method: 'tools/list' });
            toolsCheckedAt = now;
            if (introspection.ok && introspection.tools && introspection.tools.length > 0) {
              toolsJson = JSON.stringify(
                introspection.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.inputSchema,
                }))
              );
              toolsSource = 'introspected';
              toolsError = null;
            } else if (introspection.authRequired) {
              // Spec-compliant 401 + WWW-Authenticate (RFC 9728) — a real,
              // correctly-configured OAuth-protected MCP server, not a broken
              // one. isVerifiedActive/healthStatus above already reflect this
              // as healthy; this message just needs to not read as a failure.
              // Reported independently as a common false-negative in other MCP
              // directories' health probes — worth getting right.
              toolsError = 'Requires authentication (OAuth) — tools not introspected by the automated check.';
            } else {
              toolsError = (
                introspection.ok ? 'Endpoint responded but returned no tools.' : introspection.error || 'Unknown error'
              ).slice(0, 500);
              // Expected, per-listing condition (endpoint doesn't support tools/list, requires
              // auth, etc.) — already recorded on the row as toolsError. console.warn keeps it
              // out of error-level alerting while still showing up in logs for debugging.
              console.warn(`[health-cron] tools/list failed for ${server.id} (${server.url}): ${toolsError}`);
            }
          }
        }
      } catch {
        healthStatus = 'offline';
      }

      // Secondary connection method: a listing can declare a hosted endpoint
      // alongside its primary install (e.g. a stdio bridge package that proxies
      // to a real remote server). When present, always prefer a live tools/list
      // handshake against it over whatever the primary path above found — it's
      // the authoritative source the owner pointed us at, not a README guess.
      // Independent try/catch so a flaky remote endpoint can't blow away the
      // primary path's result for this run.
      if (server.remoteEndpointUrl) {
        try {
          const remoteIntrospection = await callMcpEndpoint(server.remoteEndpointUrl, { method: 'tools/list' });
          toolsCheckedAt = now;
          // A successful initialize (part of callMcpEndpoint's handshake) means
          // the endpoint is up and speaking MCP correctly, regardless of whether
          // this particular listing has tools to report — genuine uptime signal,
          // tracked separately from healthStatus/isVerifiedActive (which read the
          // *primary* url, e.g. the GitHub repo for a stdio+remote listing like
          // our own — a transient endpoint blip shouldn't trip repo-archival
          // unpublish logic). See lib/qualityScore.ts for where this feeds scoring.
          remoteEndpointHealthy = remoteIntrospection.ok;
          remoteEndpointCheckedAt = now;
          if (remoteIntrospection.ok && remoteIntrospection.tools && remoteIntrospection.tools.length > 0) {
            toolsJson = JSON.stringify(
              remoteIntrospection.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
              }))
            );
            toolsSource = 'introspected';
            toolsError = null;
          } else if (remoteIntrospection.authRequired) {
            // See the primary-url branch above — same RFC 9728 case, healthy
            // endpoint, just OAuth-protected.
            toolsError = 'Requires authentication (OAuth) — tools not introspected by the automated check.';
          } else {
            toolsError = (
              remoteIntrospection.ok
                ? 'Remote endpoint responded but returned no tools.'
                : remoteIntrospection.error || 'Unknown error'
            ).slice(0, 500);
          }
        } catch {
          // A thrown error (network failure, timeout) means the endpoint didn't
          // respond — unlike the tools data (left as-is so a transient blip
          // doesn't erase a previously-good tool list), health explicitly
          // reflects this as down; that's the whole point of tracking it.
          remoteEndpointHealthy = false;
          remoteEndpointCheckedAt = now;
        }
      }

      if (
        !server.isPremium &&
        server.websiteUrl &&
        server.websiteVerified &&
        isSafeFetchTarget(server.websiteUrl)
      ) {
        try {
          const siteRes = await fetch(server.websiteUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(10000),
          });
          reciprocalBadgeOk =
            siteRes.ok && websiteHasReciprocalBadge(await siteRes.text(), server.id);
        } catch {
          reciprocalBadgeOk = false;
        }
      }

      // Install hint: README first, then description, then deterministic resolve
      let installFields: ReturnType<typeof toCachedInstallFields> | null = null;
      const fromReadme = readmeText
        ? resolveInstallFromText(readmeText, {
            id: server.id,
            name: server.name,
            url: server.url,
          })
        : null;
      if (fromReadme) {
        installFields = toCachedInstallFields(fromReadme);
        installHintsUpdated++;
      } else {
        const resolved = resolveInstallConfig({
          id: server.id,
          name: server.name,
          url: server.url,
          description: server.description,
          // Do not re-use old cache here — recompute so we can refresh
        });
        // Only persist non-low confidence so we don't lock in bad guesses forever
        if (resolved.confidence !== 'low' || resolved.source !== 'heuristic') {
          installFields = toCachedInstallFields(resolved);
          installHintsUpdated++;
        }
      }

      // Dead/archived GitHub projects: unpublish so the public catalog stays fresh.
      // Soft-remove only — rows stay for admin recovery (status = removed).
      const shouldUnpublish = healthStatus === 'archived';

      await db
        .update(servers)
        .set({
          lastCheckedAt: now,
          isVerifiedActive,
          healthStatus,
          reciprocalBadgeOk,
          badgeLastCheckedAt: now,
          githubStars,
          lastCommitAt,
          npmDownloads,
          tools: toolsJson,
          toolsCheckedAt,
          toolsError,
          toolsSource,
          remoteEndpointHealthy,
          remoteEndpointCheckedAt,
          ...(shouldUnpublish ? { status: 'removed' } : {}),
          ...(installFields
            ? {
                installKind: installFields.installKind,
                installCommand: installFields.installCommand,
                installArgs: installFields.installArgs,
                installPackage: installFields.installPackage,
                installConfidence: installFields.installConfidence,
              }
            : {}),
        })
        .where(eq(servers.id, server.id));

      // Bounded health-check history for the detail-page trend strip (see
      // db/schema.ts). Insert then trim to the last HEALTH_HISTORY_LIMIT for
      // this listing so the table stays flat-sized rather than growing with
      // total checks ever performed — two small single-server queries, well
      // under D1's 100-bound-param cap regardless of catalog size.
      await db.insert(serverHealthChecks).values({
        serverId: server.id,
        checkedAt: now,
        healthy: isVerifiedActive,
        detail: isVerifiedActive ? null : healthStatus,
        // Only meaningfully set (non-carried-forward) when this listing has a
        // remoteEndpointUrl — see remoteEndpointHealthy's declaration above.
        remoteHealthy: server.remoteEndpointUrl ? remoteEndpointHealthy : null,
      });
      const keepIds = await db
        .select({ id: serverHealthChecks.id })
        .from(serverHealthChecks)
        .where(eq(serverHealthChecks.serverId, server.id))
        .orderBy(desc(serverHealthChecks.checkedAt))
        .limit(HEALTH_HISTORY_LIMIT);
      if (keepIds.length === HEALTH_HISTORY_LIMIT) {
        await db
          .delete(serverHealthChecks)
          .where(
            and(
              eq(serverHealthChecks.serverId, server.id),
              notInArray(serverHealthChecks.id, keepIds.map((r) => r.id))
            )
          );
      }

      if (shouldUnpublish) unpublished++;
      processed++;
    }

    return NextResponse.json({
      success: true,
      processed,
      installHintsUpdated,
      unpublished,
      message: `Verified ${processed} servers (${installHintsUpdated} install hints, ${unpublished} unpublished).`,
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
