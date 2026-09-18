import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '../../../../db/schema';
import { generateListingContent } from '../../../../lib/aiContent';
import { DEFAULT_SUBMIT_CATEGORY } from '../../../../lib/categories';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import { cleanListingDescription } from '../../../../lib/description';
import { getGithubToken } from '../../../../lib/githubAuth';
import {
  fetchGithubReadme,
  parseGithubUrl,
} from '../../../../lib/listingEnrich';
import {
  reviewListing,
  shouldSkipAiWriteup,
} from '../../../../lib/listingReview';
import {
  classifyListingFields,
  installHintToCache,
  pickInstallCommand,
} from '../../../../lib/listingSignals';
import { parseServerTools } from '../../../../lib/servers';

/**
 * AI content pass — writes the unique per-listing content layer (summary, overview,
 * use cases, features, faq, envVars, authType, pricingModel, license, tags, compatibleClients)
 * that turns scraped README-mirror pages into rich, original listings.
 *
 * Also validates/replaces install_kind/install_command/install_args/install_package,
 * which used to come solely from a regex/heuristic README parser (lib/tools/parseInstallHint.ts
 * via the health cron). That parser routinely mistook mentioned third-party installer CLIs,
 * debugging tools, and generic framework dependencies for the listing's own install command —
 * an LLM reading the README with context can tell those apart, and voids the field entirely
 * (rather than guessing) when it isn't confident. See installExtractedAt in db/schema.ts.
 */

// Kept at 6 so a single run executes within Cloudflare's HTTP edge timeout (~100s,
// each concurrent LLM call takes ~15-20s). Dynamic via ?batchSize= (capped at 24).
const DEFAULT_BATCH_SIZE = 6;
// Claim step is a single atomic UPDATE ... WHERE id IN (subquery), so raising
// this is safe against double-claims even under concurrent callers. Was
// bumped to 10 for throughput, then reverted: the real constraint isn't
// OpenAI's rate limit (accommodates far more), it's that this endpoint runs
// in the same shared Worker instance as live page traffic — confirmed in
// practice, 10 x parallel_calls=3 (up to 30 concurrent README fetches +
// OpenAI calls) correlated with "Worker exceeded memory limit" and hung-
// request errors on real /mcp/[id] page loads during a backfill run. Back to
// the original conservative value; don't raise this again without a way to
// isolate backfill load from production traffic (e.g. a separate Worker/
// queue) rather than just retuning the number.
const CONCURRENCY = 6;
const MIN_MATERIAL_CHARS = 30;
const STALE_RECHECK_MS = 90 * 24 * 60 * 60 * 1000;

type ClaimedRow = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  tools: string | null;
  previousEnrichedAt?: Date | null;
  pass: 'writeup' | 'install' | 'metadata';
};

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
    const claimTime = new Date();

    const url = new URL(req.url);
    const queryBatch = Number(
      url.searchParams.get('batchSize') || url.searchParams.get('limit'),
    );
    const batchSize =
      Number.isFinite(queryBatch) && queryBatch > 0
        ? Math.min(Math.floor(queryBatch), 24)
        : DEFAULT_BATCH_SIZE;

    // Phase 1: atomically claim highest-value never-enriched or missing-writeup listings
    const claimedNew = (await db
      .update(servers)
      .set({ aiEnrichedAt: claimTime })
      .where(
        inArray(
          servers.id,
          db
            .select({ id: servers.id })
            .from(servers)
            .where(
              and(
                eq(servers.status, 'active'),
                or(isNull(servers.aiEnrichedAt), isNull(servers.aiDoc)),
              ),
            )
            .orderBy(
              desc(servers.views),
              desc(servers.upvotes),
              sql`${servers.githubStars} IS NULL`,
              desc(servers.githubStars),
              asc(servers.createdAt),
            )
            .limit(batchSize),
        ),
      )
      .returning({
        id: servers.id,
        name: servers.name,
        url: servers.url,
        description: servers.description,
        category: servers.category,
        tools: servers.tools,
      })) as Omit<ClaimedRow, 'pass'>[];

    const claimedWriteup: ClaimedRow[] = claimedNew.map((c) => ({
      ...c,
      pass: 'writeup' as const,
    }));

    let claimedStale: ClaimedRow[] = [];
    const staleSlots = batchSize - claimedNew.length;
    if (staleSlots > 0) {
      const staleCutoff = new Date(claimTime.getTime() - STALE_RECHECK_MS);
      const candidates = await db
        .select({
          id: servers.id,
          name: servers.name,
          url: servers.url,
          description: servers.description,
          category: servers.category,
          tools: servers.tools,
          aiEnrichedAt: servers.aiEnrichedAt,
        })
        .from(servers)
        .where(
          and(
            eq(servers.status, 'active'),
            isNotNull(servers.aiEnrichedAt),
            lt(servers.aiEnrichedAt, staleCutoff),
          ),
        )
        .orderBy(asc(servers.aiEnrichedAt))
        .limit(staleSlots);

      if (candidates.length > 0) {
        await db
          .update(servers)
          .set({ aiEnrichedAt: claimTime })
          .where(
            inArray(
              servers.id,
              candidates.map((c) => c.id),
            ),
          );
        claimedStale = candidates.map((c) => ({
          id: c.id,
          name: c.name,
          url: c.url,
          description: c.description,
          category: c.category,
          tools: c.tools,
          previousEnrichedAt: c.aiEnrichedAt as Date | null,
          pass: 'writeup' as const,
        }));
      }
    }

    let claimedInstall: ClaimedRow[] = [];
    let claimedMetadata: ClaimedRow[] = [];
    const writeupCount = claimedWriteup.length + claimedStale.length;
    const leftover = batchSize - writeupCount;
    if (leftover > 0) {
      const installClaim = (await db
        .update(servers)
        .set({ installExtractedAt: claimTime })
        .where(
          inArray(
            servers.id,
            db
              .select({ id: servers.id })
              .from(servers)
              .where(
                and(
                  eq(servers.status, 'active'),
                  isNotNull(servers.aiEnrichedAt),
                  isNotNull(servers.aiDoc),
                  isNull(servers.installExtractedAt),
                ),
              )
              .orderBy(
                desc(servers.views),
                desc(servers.upvotes),
                asc(servers.createdAt),
              )
              .limit(leftover),
          ),
        )
        .returning({
          id: servers.id,
          name: servers.name,
          url: servers.url,
          description: servers.description,
          category: servers.category,
          tools: servers.tools,
        })) as Omit<ClaimedRow, 'pass'>[];
      claimedInstall = installClaim.map((c) => ({
        ...c,
        pass: 'install' as const,
      }));
    }

    const leftoverAfterInstall = leftover - claimedInstall.length;
    if (leftoverAfterInstall > 0) {
      const metaRows = await db
        .select({
          id: servers.id,
          name: servers.name,
          url: servers.url,
          description: servers.description,
          category: servers.category,
          tools: servers.tools,
        })
        .from(servers)
        .where(
          and(
            eq(servers.status, 'active'),
            isNotNull(servers.aiDoc),
            or(isNull(servers.authType), isNull(servers.pricingModel)),
          ),
        )
        .orderBy(desc(servers.views), asc(servers.createdAt))
        .limit(leftoverAfterInstall);
      claimedMetadata = metaRows.map((c) => ({
        ...c,
        pass: 'metadata' as const,
      }));
    }

    const claimed = [
      ...claimedWriteup,
      ...claimedStale,
      ...claimedInstall,
      ...claimedMetadata,
    ];
    const stats = {
      claimed: claimed.length,
      claimedNew: claimedWriteup.length,
      claimedStale: claimedStale.length,
      claimedInstall: claimedInstall.length,
      claimedMetadata: claimedMetadata.length,
      enriched: 0,
      skippedThin: 0,
      skippedJev: 0,
      installPicked: 0,
      metadataFilled: 0,
      failed: 0,
      budgetStopped: false,
    };
    const keep = new Set<string>();
    let budgetHit = false;

    for (let i = 0; i < claimed.length && !budgetHit; i += CONCURRENCY) {
      const chunk = claimed.slice(i, i + CONCURRENCY);

      const results = await Promise.all(
        chunk.map(async (server) => {
          const gh = parseGithubUrl(server.url);
          const readme = gh
            ? await fetchGithubReadme(gh.owner, gh.repo, githubToken)
            : null;
          const cleanedDesc = cleanListingDescription(server.description) || '';
          const signalInput = {
            name: server.name,
            description: server.description,
            url: server.url,
            readme,
          };

          if (server.pass === 'metadata') {
            const fields = await classifyListingFields(signalInput);
            return { server, fields };
          }

          if (server.pass === 'install') {
            const hint = await pickInstallCommand(signalInput);
            return { server, hint };
          }

          if (!readme && cleanedDesc.length < MIN_MATERIAL_CHARS) {
            return { server, thin: true as const };
          }

          const review = await reviewListing({
            name: server.name,
            description: server.description,
            url: server.url,
          });
          if (shouldSkipAiWriteup(review)) {
            return { server, skipJev: true as const };
          }

          const [fields, hint] = await Promise.all([
            classifyListingFields(signalInput),
            pickInstallCommand(signalInput),
          ]);
          const outcome = await generateListingContent({
            name: server.name,
            description: server.description,
            category: fields.category || server.category,
            isCategoryConfirmed: Boolean(fields.category),
            url: server.url,
            readme,
            tools: parseServerTools(server.tools),
            omitStructured: true,
          });
          return { server, outcome, fields, hint };
        }),
      );

      for (const r of results) {
        if ('thin' in r) {
          stats.skippedThin++;
          keep.add(r.server.id);
          continue;
        }
        if ('skipJev' in r) {
          stats.skippedJev++;
          keep.add(r.server.id);
          continue;
        }
        if (r.server.pass === 'metadata' && 'fields' in r && r.fields) {
          const fields = r.fields;
          const updatePayload: Record<string, unknown> = {};
          if (fields.pricingModel)
            updatePayload.pricingModel = fields.pricingModel;
          if (fields.authType) updatePayload.authType = fields.authType;
          if (
            fields.category &&
            r.server.category === DEFAULT_SUBMIT_CATEGORY
          ) {
            updatePayload.category = fields.category;
          }
          if (Object.keys(updatePayload).length > 0) {
            await db
              .update(servers)
              .set(updatePayload as any)
              .where(eq(servers.id, r.server.id));
            stats.metadataFilled++;
          }
          keep.add(r.server.id);
          continue;
        }
        if ('hint' in r && r.server.pass === 'install') {
          const cached = r.hint ? installHintToCache(r.hint) : null;
          await db
            .update(servers)
            .set(
              cached
                ? { ...cached, installExtractedAt: claimTime }
                : {
                    installKind: null,
                    installCommand: null,
                    installArgs: null,
                    installPackage: null,
                    installConfidence: null,
                    installExtractedAt: claimTime,
                  },
            )
            .where(eq(servers.id, r.server.id));
          stats.installPicked++;
          keep.add(r.server.id);
          continue;
        }
        const o = 'outcome' in r ? r.outcome : undefined;
        if (o?.status === 'ok') {
          const updatePayload: Record<string, unknown> = {
            aiSummary: o.content.summary,
            aiOverview: o.content.overview || null,
            aiDoc: o.content.doc || null,
            aiDocAt: claimTime,
            aiUseCases: o.content.useCases.length
              ? JSON.stringify(o.content.useCases)
              : null,
            aiFeatures: o.content.features.length
              ? JSON.stringify(o.content.features)
              : null,
            aiEnvVars: o.content.envVars.length
              ? JSON.stringify(o.content.envVars)
              : null,
            aiFaq: o.content.faq.length ? JSON.stringify(o.content.faq) : null,
            aiFaqAt: claimTime,
          };

          const fields = 'fields' in r ? r.fields : undefined;
          const category = fields?.category || o.content.category;
          if (category && r.server.category === DEFAULT_SUBMIT_CATEGORY) {
            updatePayload.category = category;
          }
          if (fields?.pricingModel)
            updatePayload.pricingModel = fields.pricingModel;
          else if (o.content.pricingModel)
            updatePayload.pricingModel = o.content.pricingModel;
          if (fields?.authType) updatePayload.authType = fields.authType;
          else if (o.content.authType)
            updatePayload.authType = o.content.authType;
          if (o.content.license) updatePayload.license = o.content.license;
          if (o.content.tags && o.content.tags.length > 0)
            updatePayload.tags = JSON.stringify(o.content.tags);
          if (
            o.content.compatibleClients &&
            o.content.compatibleClients.length > 0
          ) {
            updatePayload.compatibleClients = JSON.stringify(
              o.content.compatibleClients,
            );
          }

          updatePayload.installExtractedAt = claimTime;
          const hint = 'hint' in r ? r.hint : undefined;
          const cached = hint ? installHintToCache(hint) : null;
          const install = cached || o.content.install;
          if (cached) {
            Object.assign(updatePayload, cached);
          } else if (install && 'kind' in install) {
            updatePayload.installKind = install.kind;
            updatePayload.installCommand =
              install.kind === 'stdio' ? (install.command ?? null) : null;
            updatePayload.installArgs =
              install.kind === 'stdio' &&
              install.args &&
              install.args.length > 0
                ? JSON.stringify(install.args)
                : null;
            updatePayload.installPackage = install.package ?? null;
            updatePayload.installConfidence = install.confidence;
          } else {
            updatePayload.installKind = null;
            updatePayload.installCommand = null;
            updatePayload.installArgs = null;
            updatePayload.installPackage = null;
            updatePayload.installConfidence = null;
          }

          await db
            .update(servers)
            .set(updatePayload as any)
            .where(eq(servers.id, r.server.id));
          stats.enriched++;
          keep.add(r.server.id);
        } else {
          stats.failed++;
          if (o?.status === 'budget') budgetHit = true;
        }
      }
    }

    // Release every claimed row we didn't complete: failures, plus anything left unprocessed
    // when a budget stop broke the loop. Never-enriched releases return to NULL (top
    // priority again); stale re-checks release back to their previous ai_enriched_at, not
    // NULL, so a re-check that keeps failing doesn't masquerade as brand-new backlog.
    const unreleased = claimed.filter((c) => !keep.has(c.id));
    const releaseNew = unreleased
      .filter((c) => c.pass === 'writeup' && c.previousEnrichedAt === undefined)
      .map((c) => c.id);
    const releaseStale = unreleased.filter(
      (c) => c.pass === 'writeup' && c.previousEnrichedAt !== undefined,
    );
    const releaseInstall = unreleased
      .filter((c) => c.pass === 'install')
      .map((c) => c.id);
    if (releaseNew.length > 0) {
      await db
        .update(servers)
        .set({ aiEnrichedAt: null })
        .where(inArray(servers.id, releaseNew));
    }
    for (const row of releaseStale) {
      await db
        .update(servers)
        .set({ aiEnrichedAt: row.previousEnrichedAt })
        .where(eq(servers.id, row.id));
    }
    if (releaseInstall.length > 0) {
      await db
        .update(servers)
        .set({ installExtractedAt: null })
        .where(inArray(servers.id, releaseInstall));
    }
    stats.budgetStopped = budgetHit;

    const [{ remaining }] = await db
      .select({ remaining: sql<number>`count(*)` })
      .from(servers)
      .where(and(eq(servers.status, 'active'), isNull(servers.aiEnrichedAt)));

    const [{ installRemaining }] = await db
      .select({ installRemaining: sql<number>`count(*)` })
      .from(servers)
      .where(
        and(eq(servers.status, 'active'), isNull(servers.installExtractedAt)),
      );

    const [{ docRemaining }] = await db
      .select({ docRemaining: sql<number>`count(*)` })
      .from(servers)
      .where(and(eq(servers.status, 'active'), isNull(servers.aiDoc)));

    const staleCutoffNow = new Date(Date.now() - STALE_RECHECK_MS);
    const [{ dueForRecheck }] = await db
      .select({ dueForRecheck: sql<number>`count(*)` })
      .from(servers)
      .where(
        and(
          eq(servers.status, 'active'),
          isNotNull(servers.aiEnrichedAt),
          lt(servers.aiEnrichedAt, staleCutoffNow),
        ),
      );

    return NextResponse.json({
      success: true,
      ...stats,
      remaining,
      dueForRecheck,
      installRemaining,
      docRemaining,
      githubAuth: Boolean(githubToken),
      message:
        `AI content: enriched ${stats.enriched} (${stats.claimedNew} new, ${stats.claimedStale} re-checked), ` +
        `install ${stats.installPicked}, metadata ${stats.metadataFilled}, ` +
        `skipped-thin ${stats.skippedThin}, skipped-jev ${stats.skippedJev}, failed ${stats.failed}${
          stats.budgetStopped ? ' (stopped — LLM spend cap/outage)' : ''
        }. ~${remaining} never-enriched, ~${dueForRecheck} due for re-check, ~${installRemaining} install-unchecked, ~${docRemaining} without a writeup.`,
    });
  } catch (error: any) {
    console.error('AI content cron error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
