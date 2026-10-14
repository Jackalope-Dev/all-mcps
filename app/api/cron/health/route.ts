import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, asc, desc, eq, notInArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import {
  listingSignals,
  serverHealthChecks,
  servers,
} from '../../../../db/schema';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import { cronServerColumns } from '../../../../lib/cronServerColumns';
import { getGithubToken, githubApiHeaders } from '../../../../lib/githubAuth';
import {
  batchableRepoSlug,
  fetchRepoSnapshotRest,
  fetchRepoSnapshots,
  type RepoSnapshot,
} from '../../../../lib/githubBatch';
import { healthDueSql } from '../../../../lib/healthTier';
import {
  resolveInstallConfig,
  resolveInstallFromText,
  toCachedInstallFields,
} from '../../../../lib/installConfig';
import {
  isCatalogReadme,
  isListingTrulyDead,
} from '../../../../lib/listingEnrich';
import {
  listingRenderChanged,
  refreshListingPages,
} from '../../../../lib/listingPageRefresh';
import { callMcpEndpoint } from '../../../../lib/mcpIntrospect';
import { npmPackageFor } from '../../../../lib/packageRegistry';
import type { ToolDefinition } from '../../../../lib/securityProfile';
import { storeSecurityProfile } from '../../../../lib/securityProfileStore';
import { upsertSignals } from '../../../../lib/signalStore';
import { parseToolsFromReadme } from '../../../../lib/tools/parseToolsFromReadme';
import { probeRemoteEndpoint } from '../../../../lib/tools/verifyRemoteEndpoint';
import { isSafeSubmissionUrl } from '../../../../lib/urlSafety';
import { websiteHasReciprocalBadge } from '../../../../lib/verification';

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
  if (
    !name ||
    /^[.\-_]+$/.test(name) ||
    /\s/.test(name) ||
    name.includes('://')
  )
    return null;
  try {
    const res = await fetch(
      `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`,
      {
        headers: { 'User-Agent': 'AllMCPs-Health-Checker' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { downloads?: number; package?: string };
    if (typeof data.downloads !== 'number' || data.package !== name)
      return null;
    // No real single npm package has ever cleared ~1B monthly downloads.
    if (data.downloads > 1_000_000_000) return null;
    return data.downloads;
  } catch {
    return null;
  }
}

/** README text at `path` on the default branch, or null (missing, or a catalog README). */
async function fetchReadmeText(
  slug: string,
  path: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${slug}/HEAD/${path}`,
      {
        headers: { 'User-Agent': 'AllMCPs-Health-Checker' },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return null;
    // A catalog README describes other servers; nothing here may read it
    // as this listing's (see isCatalogReadme).
    const text = await res.text();
    const [owner, repo] = slug.split('/');
    return isCatalogReadme(text, owner, repo) ? null : text;
  } catch {
    return null;
  }
}

/**
 * Listings per run. Due listings come first (lib/healthTier.ts: popular ones
 * daily, the long tail weekly); GitHub repos are read 50 to a GraphQL query
 * and READMEs are downloaded only when their blob id changed, so most
 * listings cost one npm call at most.
 */
const BATCH_SIZE = 150;
/** Listings checked at once. Each makes a few sequential fetches. */
const CONCURRENCY = 6;
/**
 * Bounds server_health_checks per listing — see db/schema.ts for why. At the
 * daily cadence of the busiest listings, 96 rows is about three months of
 * history; enough for the detail page's trend strip.
 */
const HEALTH_HISTORY_LIMIT = 96;
/** Statements per db.batch. */
const WRITE_CHUNK = 40;

type Db = ReturnType<typeof drizzle>;
type HealthRow = Awaited<ReturnType<typeof selectDueListings>>[number];

async function selectDueListings(db: Db, now: Date) {
  return db
    .select({
      ...cronServerColumns,
      readmeHash: listingSignals.readmeHash,
      latestReleaseTag: listingSignals.latestReleaseTag,
    })
    .from(servers)
    .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
    .where(and(eq(servers.status, 'active'), healthDueSql(now)))
    .orderBy(asc(servers.lastCheckedAt))
    .limit(BATCH_SIZE);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

type CheckResult = {
  statements: unknown[];
  installHintUpdated: boolean;
  unpublished: boolean;
  contentChanged: boolean;
  pageChanged: boolean;
};

async function checkListing(
  db: Db,
  server: HealthRow,
  snapshot: RepoSnapshot | undefined,
  repoSlug: string | null,
  now: Date,
): Promise<CheckResult> {
  let isVerifiedActive = false;
  let healthStatus = 'unknown';
  // True when the check could not reach a verdict this pass (GitHub rate
  // limit or outage): keep the last verdict and record no history row.
  let inconclusive = false;
  // Two independent reciprocal-backlink signals, tracked separately so the
  // repo README badge and the custom-website backlink never overwrite each
  // other on listings that have both. `reciprocalBadgeOk` below is the
  // derived aggregate persisted for the rest of the app.
  let readmeBadgeOk = server.readmeBadgeOk;
  let websiteBacklinkOk = server.websiteBacklinkOk;
  let githubStars: number | null = server.githubStars ?? null;
  let toolsJson: string | null = server.tools ?? null;
  let toolsCheckedAt: Date | null = server.toolsCheckedAt ?? null;
  let toolsError: string | null = server.toolsError ?? null;
  let toolsSource: string | null = server.toolsSource ?? null;
  let lastCommitAt: Date | null = server.lastCommitAt ?? null;
  // undefined = GitHub was not asked this pass; leave the stored value alone.
  let repoForkOf: string | null | undefined;
  let readmeHash = server.readmeHash ?? null;
  let latestReleaseTag = server.latestReleaseTag ?? null;
  let contentChanged = false;
  // Set only when this pass completed a live tools/list, so the security
  // profile is rebuilt from tools we just saw, never from a README guess.
  let liveTools: ToolDefinition[] | null = null;
  let remoteEndpointHealthy: boolean | null =
    server.remoteEndpointHealthy ?? null;
  let remoteEndpointCheckedAt: Date | null =
    server.remoteEndpointCheckedAt ?? null;

  // Only a real npm install has npm downloads. A non-npm listing keeps null
  // rather than borrowing a same-named package's count.
  const npmName = npmPackageFor(server);
  const npmDownloads = npmName
    ? ((await fetchNpmDownloads(npmName)) ?? server.npmDownloads ?? null)
    : null;

  let readmeText: string | null = null;

  try {
    if (repoSlug) {
      if (!snapshot || snapshot.kind === 'error') {
        inconclusive = true;
      } else if (snapshot.kind === 'missing') {
        healthStatus = 'offline';
      } else {
        githubStars = snapshot.stars;
        if (snapshot.pushedAt) lastCommitAt = snapshot.pushedAt;
        // Feeds the stale sweep's unmodified-fork rule.
        repoForkOf = snapshot.forkOf;
        if (snapshot.archived) {
          healthStatus = 'archived';
        } else {
          isVerifiedActive = true;
          healthStatus = 'healthy';
        }

        // A changed README or a new release is new source material for the
        // writeup; the ai-content cron refreshes rows whose
        // content_changed_at is newer than their enrichment. A first
        // sighting only records the hash: it is not a change.
        if (
          (server.readmeHash &&
            snapshot.readmeOid &&
            snapshot.readmeOid !== server.readmeHash) ||
          (server.latestReleaseTag &&
            snapshot.latestReleaseTag &&
            snapshot.latestReleaseTag !== server.latestReleaseTag)
        ) {
          contentChanged = true;
        }
        const readmeChanged =
          snapshot.readmeOid != null && snapshot.readmeOid !== readmeHash;
        readmeHash = snapshot.readmeOid ?? readmeHash;
        latestReleaseTag = snapshot.latestReleaseTag ?? latestReleaseTag;

        // Everything below reads the README, so it only runs when the README
        // changed (or was never read for tools/install). An unchanged blob id
        // means the badge, tool list and install hint we stored still hold.
        const needsReadme =
          readmeChanged ||
          toolsCheckedAt == null ||
          (!server.installExtractedAt && !server.installKind);
        if (needsReadme && snapshot.readmePath) {
          readmeText = await fetchReadmeText(repoSlug, snapshot.readmePath);
        }
        if (readmeText) {
          readmeBadgeOk = websiteHasReciprocalBadge(readmeText, server.id);
        }

        // GitHub-linked listings are almost always stdio packages (npx/uvx/pip), not a
        // live HTTP endpoint, so the tools/list handshake below never applies to them —
        // this is the only source of tool data they'll ever get. Never overwrite a real
        // live-introspected result with a weaker guess.
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
      }
    } else if (!isSafeSubmissionUrl(server.url)) {
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
        const introspection = await callMcpEndpoint(server.url, {
          method: 'tools/list',
        });
        toolsCheckedAt = now;
        if (
          introspection.ok &&
          introspection.tools &&
          introspection.tools.length > 0
        ) {
          liveTools = introspection.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          }));
          toolsJson = JSON.stringify(liveTools);
          toolsSource = 'introspected';
          toolsError = null;
        } else if (introspection.authRequired) {
          // Spec-compliant 401 + WWW-Authenticate (RFC 9728) — a real,
          // correctly-configured OAuth-protected MCP server, not a broken
          // one. isVerifiedActive/healthStatus above already reflect this
          // as healthy; this message just needs to not read as a failure.
          toolsError =
            'Requires authentication (OAuth) — tools not introspected by the automated check.';
        } else {
          toolsError = (
            introspection.ok
              ? 'Endpoint responded but returned no tools.'
              : introspection.error || 'Unknown error'
          ).slice(0, 500);
          // Expected, per-listing condition — already recorded on the row as
          // toolsError. console.warn keeps it out of error-level alerting.
          console.warn(
            `[health-cron] tools/list failed for ${server.id} (${server.url}): ${toolsError}`,
          );
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
      const remoteIntrospection = await callMcpEndpoint(
        server.remoteEndpointUrl,
        { method: 'tools/list' },
      );
      toolsCheckedAt = now;
      // A successful initialize means the endpoint is up and speaking MCP,
      // tracked separately from healthStatus/isVerifiedActive (which read the
      // *primary* url) so a transient endpoint blip can't trip repo-archival
      // unpublish logic. See lib/qualityScore.ts for where this feeds scoring.
      remoteEndpointHealthy = remoteIntrospection.ok;
      remoteEndpointCheckedAt = now;
      if (
        remoteIntrospection.ok &&
        remoteIntrospection.tools &&
        remoteIntrospection.tools.length > 0
      ) {
        liveTools = remoteIntrospection.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        }));
        toolsJson = JSON.stringify(liveTools);
        toolsSource = 'introspected';
        toolsError = null;
      } else if (remoteIntrospection.authRequired) {
        toolsError =
          'Requires authentication (OAuth) — tools not introspected by the automated check.';
      } else {
        toolsError = (
          remoteIntrospection.ok
            ? 'Remote endpoint responded but returned no tools.'
            : remoteIntrospection.error || 'Unknown error'
        ).slice(0, 500);
      }
    } catch {
      // A thrown error (network failure, timeout) means the endpoint didn't
      // respond — tools data is left as-is so a blip doesn't erase a good
      // tool list, but health explicitly reflects this as down.
      remoteEndpointHealthy = false;
      remoteEndpointCheckedAt = now;
    }
  }

  // The website backlink is a separate public-content check from the repo
  // README badge above, so it writes its own signal and never overwrites the
  // README result. Premium is skipped since it's already dofollow.
  if (
    !server.isPremium &&
    server.websiteUrl &&
    isSafeSubmissionUrl(server.websiteUrl)
  ) {
    try {
      const siteRes = await fetch(server.websiteUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      websiteBacklinkOk =
        siteRes.ok &&
        websiteHasReciprocalBadge(await siteRes.text(), server.id);
    } catch {
      websiteBacklinkOk = false;
    }
  }

  const reciprocalBadgeOk = readmeBadgeOk || websiteBacklinkOk;

  // Install hint: README first, then description, then deterministic resolve.
  //
  // Skipped entirely once the AI pipeline has validated this listing's install
  // (installExtractedAt set, see db/schema.ts): that pass reads the whole README with
  // context and is the documented source of truth — including when its verdict is
  // "no confident install" and it deliberately voids the fields to null. A regex
  // cannot tell a debugging CLI or an installer CLI from the server itself, so
  // without this guard it reinstated exactly the guesses the LLM had rejected.
  let installFields: ReturnType<typeof toCachedInstallFields> | null = null;
  let installHintUpdated = false;
  if (!server.installExtractedAt) {
    const fromReadme = readmeText
      ? resolveInstallFromText(readmeText, {
          id: server.id,
          name: server.name,
          url: server.url,
        })
      : null;
    // toCachedInstallFields returns null when a resolved install must not be cached,
    // so a README hint that fails that bar falls through to the deterministic resolve.
    installFields = fromReadme ? toCachedInstallFields(fromReadme) : null;
    if (installFields) {
      installHintUpdated = true;
    } else {
      const resolved = resolveInstallConfig({
        id: server.id,
        name: server.name,
        url: server.url,
        description: server.description,
      });
      // Only persist non-low confidence so we don't lock in bad guesses forever
      if (resolved.confidence !== 'low' || resolved.source !== 'heuristic') {
        installFields = toCachedInstallFields(resolved);
        if (installFields) installHintUpdated = true;
      }
    }
  }

  // A cached remote endpoint is a URL we hand to clients as "connect here". Before
  // caching a *new or changed* endpoint, ask it directly, and refuse to store one the
  // probe proves is not MCP. Inconclusive results change nothing; see
  // lib/tools/verifyRemoteEndpoint.ts. Re-verifying endpoints that rot after being
  // cached is scripts/verify-cached-remote-endpoints.ts.
  let clearInstallFields = false;
  if (
    installFields?.installKind === 'remote' &&
    installFields.installPackage !== server.installPackage
  ) {
    const probe = await probeRemoteEndpoint(installFields.installPackage);
    if (probe.verdict === 'not-mcp') {
      installFields = null;
      clearInstallFields = server.installKind === 'remote';
    }
  }

  // A cached remote install (installKind 'remote') is the URL we hand clients
  // as "connect here", and used to be checked only once, when first cached.
  // Handshake it every pass like a declared remoteEndpointUrl: live tools
  // when it answers, and if a probe proves it no longer speaks MCP (an HTML
  // page, a 404) the install is cleared rather than left on the page.
  const cachedEndpoint =
    !server.remoteEndpointUrl &&
    !clearInstallFields &&
    (installFields?.installKind ?? server.installKind) === 'remote'
      ? (installFields?.installPackage ?? server.installPackage)
      : null;
  if (
    cachedEndpoint &&
    cachedEndpoint !== server.url &&
    isSafeSubmissionUrl(cachedEndpoint)
  ) {
    const handshake = await callMcpEndpoint(cachedEndpoint, {
      method: 'tools/list',
    }).catch(() => null);
    remoteEndpointCheckedAt = now;
    if (handshake?.ok || handshake?.authRequired) {
      remoteEndpointHealthy = true;
      if (handshake.ok && handshake.tools && handshake.tools.length > 0) {
        liveTools = handshake.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        }));
        toolsJson = JSON.stringify(liveTools);
        toolsSource = 'introspected';
        toolsError = null;
        toolsCheckedAt = now;
      }
    } else {
      remoteEndpointHealthy = false;
      const probe = await probeRemoteEndpoint(cachedEndpoint);
      if (probe.verdict === 'not-mcp') {
        installFields = null;
        clearInstallFields = true;
        remoteEndpointHealthy = null;
      }
    }
  }

  // Dead/archived GitHub projects: unpublish so the public catalog stays fresh —
  // but only once the npm/pypi package and remote endpoint are also confirmed
  // dead (see isListingTrulyDead). Soft-remove only (status = removed).
  const shouldUnpublish =
    healthStatus === 'archived'
      ? await isListingTrulyDead({
          githubDead: true,
          remoteEndpointHealthy,
          // A just-cleared install is not evidence the listing is reachable.
          installCommand: clearInstallFields
            ? null
            : (installFields?.installCommand ?? server.installCommand),
          installPackage: clearInstallFields
            ? null
            : (installFields?.installPackage ?? server.installPackage),
        })
      : false;

  if (inconclusive) {
    isVerifiedActive = Boolean(server.isVerifiedActive);
    healthStatus = server.healthStatus || 'unknown';
  }

  if (liveTools && liveTools.length > 0) {
    const { changed } = await storeSecurityProfile(
      db,
      server.id,
      liveTools,
      undefined,
      now,
    );
    if (changed) contentChanged = true;
  }

  const statements: unknown[] = [
    db
      .update(servers)
      .set({
        lastCheckedAt: now,
        isVerifiedActive,
        healthStatus,
        reciprocalBadgeOk,
        readmeBadgeOk,
        websiteBacklinkOk,
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
          : clearInstallFields
            ? {
                installKind: null,
                installCommand: null,
                installArgs: null,
                installPackage: null,
                installConfidence: null,
              }
            : {}),
      })
      .where(eq(servers.id, server.id)),
  ];

  if (
    repoForkOf !== undefined ||
    readmeHash !== (server.readmeHash ?? null) ||
    latestReleaseTag !== (server.latestReleaseTag ?? null) ||
    contentChanged
  ) {
    statements.push(
      upsertSignals(db, server.id, {
        ...(repoForkOf !== undefined ? { repoForkOf } : {}),
        readmeHash,
        latestReleaseTag,
        ...(contentChanged ? { contentChangedAt: now } : {}),
      }),
    );
  }

  // Bounded health-check history for the detail-page trend strip. An
  // inconclusive pass records nothing, so a GitHub rate limit never shows up
  // as downtime. Insert, then trim this listing to the newest
  // HEALTH_HISTORY_LIMIT in one statement.
  if (!inconclusive) {
    statements.push(
      db.insert(serverHealthChecks).values({
        serverId: server.id,
        checkedAt: now,
        healthy: isVerifiedActive,
        detail: isVerifiedActive ? null : healthStatus,
        // Only meaningfully set when this listing has a remoteEndpointUrl.
        remoteHealthy: server.remoteEndpointUrl ? remoteEndpointHealthy : null,
      }),
      db
        .delete(serverHealthChecks)
        .where(
          and(
            eq(serverHealthChecks.serverId, server.id),
            notInArray(
              serverHealthChecks.id,
              db
                .select({ id: serverHealthChecks.id })
                .from(serverHealthChecks)
                .where(eq(serverHealthChecks.serverId, server.id))
                .orderBy(desc(serverHealthChecks.checkedAt))
                .limit(HEALTH_HISTORY_LIMIT),
            ),
          ),
        ),
    );
  }

  return {
    statements,
    installHintUpdated,
    unpublished: shouldUnpublish,
    contentChanged,
    pageChanged: listingRenderChanged(server, {
      websiteBacklinkOk,
      status: shouldUnpublish ? 'removed' : undefined,
    }),
  };
}

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env: CloudflareEnv | undefined;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env?.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);
    const githubToken = getGithubToken(env);
    const now = new Date();

    const batch = await selectDueListings(db, now);
    if (batch.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No listings due for a health check.',
      });
    }

    // One GraphQL round trip per 50 GitHub repos; REST per repo without a token.
    const slugs = new Map<string, string>();
    for (const s of batch) {
      const slug = batchableRepoSlug(s.url);
      if (slug) slugs.set(s.id, slug);
    }
    const uniqueSlugs = [...new Set(slugs.values())];
    const restHeaders = githubApiHeaders(
      null,
      'application/vnd.github+json',
      'AllMCPs-Health-Checker',
    );
    const snapshots: Map<string, RepoSnapshot> = githubToken
      ? await fetchRepoSnapshots(uniqueSlugs, githubToken)
      : new Map(
          await mapWithConcurrency(
            uniqueSlugs,
            CONCURRENCY,
            async (slug) =>
              [slug, await fetchRepoSnapshotRest(slug, restHeaders)] as const,
          ),
        );

    const results = await mapWithConcurrency(batch, CONCURRENCY, (server) => {
      const slug = slugs.get(server.id) ?? null;
      return checkListing(
        db,
        server,
        slug ? snapshots.get(slug) : undefined,
        slug,
        now,
      );
    });

    const statements = results.flatMap((r) => r.statements);
    for (let i = 0; i < statements.length; i += WRITE_CHUNK) {
      await db.batch(statements.slice(i, i + WRITE_CHUNK) as any);
    }

    const pagesToRefresh = batch
      .filter((_, i) => results[i].pageChanged)
      .map((s) => s.id);
    const pages = await refreshListingPages(pagesToRefresh, env);

    const installHintsUpdated = results.filter(
      (r) => r.installHintUpdated,
    ).length;
    const unpublished = results.filter((r) => r.unpublished).length;
    const contentChanged = results.filter((r) => r.contentChanged).length;
    return NextResponse.json({
      success: true,
      processed: batch.length,
      installHintsUpdated,
      unpublished,
      contentChanged,
      pagesRefreshed: pages.refreshed.length,
      pageRefreshFailed: pages.failed,
      message: `Verified ${batch.length} servers (${installHintsUpdated} install hints, ${unpublished} unpublished, ${contentChanged} content changes, ${pages.refreshed.length}/${pagesToRefresh.length} pages refreshed).`,
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
