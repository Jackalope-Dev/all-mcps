// Custom Worker entrypoint.
//
// OpenNext generates `.open-next/worker.js`, which only exports a `fetch`
// handler. Our `wrangler.jsonc` also declares two cron triggers
// ("0 */4 * * *" and "*/15 * * * *"), and Cloudflare invokes cron triggers
// through a `scheduled()` handler. Because the generated worker has no
// `scheduled()` export, every cron tick failed with "Handler does not
// export a scheduled() function".
//
// This wrapper re-exports OpenNext's `fetch` unchanged and adds a `scheduled()`
// handler that re-dispatches each cron job back through the same in-process
// Next.js handler, so the existing `/api/cron/*` routes keep owning the logic.
// `wrangler.jsonc` `main` points here instead of at `.open-next/worker.js`.

// @ts-ignore `.open-next/worker.js` is generated at build time.
import { default as handler } from "./.open-next/worker.js";

type CronJob = {
  /** Route to invoke (POST). */
  path: string;
  /**
   * Name of the Worker secret whose value authorizes this route as
   * `Authorization: Bearer <secret>`. This is a runtime secret, not part of
   * the generated `CloudflareEnv` type, so we read it dynamically. All routes
   * accept `ADMIN_SECRET` (the highlight route also accepts an optional
   * `CRON_SECRET`, but ADMIN_SECRET works everywhere, so we only need one).
   */
  secretVar: "ADMIN_SECRET";
  /**
   * Optional gate. Jobs without a gate run on every tick of whichever
   * schedule they belong to (FAST_JOBS or SLOW_JOBS below). Jobs with a gate
   * only run on ticks where it also returns true.
   */
  shouldRun?: (now: Date) => boolean;
};

// Runs every 15 min (wrangler.jsonc "*/15 * * * *") — these two used to be
// driven by a GitHub Actions workflow on the same cadence (health-check.yml,
// removed) until GH Actions usage limits forced everything cron-shaped onto
// this Worker instead.
const FAST_JOBS: CronJob[] = [
  // Rechecks listing health, badges, stars and npm downloads.
  { path: "/api/cron/health", secretVar: "ADMIN_SECRET" },
  // Catalog quality: website/homepage, logos, install hints, clean scrape chrome,
  // unpublish archived/404 GitHub repos. Every tick until the catalog is enriched.
  { path: "/api/cron/enrich", secretVar: "ADMIN_SECRET" },
];

// Runs every 4h (wrangler.jsonc "0 */4 * * *").
const SLOW_JOBS: CronJob[] = [
  // AI content layer: unique summary/overview/use-cases/features per listing. Every
  // tick until the catalog is enriched, then no-ops. For the initial backlog, drive
  // scripts/backfill-ai-content.mjs against this endpoint to drain it faster.
  { path: "/api/cron/ai-content", secretVar: "ADMIN_SECRET" },
  // FAQ backfill for listings enriched before ai-content started generating FAQ
  // pairs. Every tick until the backlog is drained, then permanently no-ops. For
  // the initial backlog, drive scripts/backfill-ai-faq.mjs to drain it faster.
  { path: "/api/cron/ai-faq", secretVar: "ADMIN_SECRET" },
  // Syncs semantic vector embeddings into Cloudflare Vectorize for natural language
  // search. Bounded batch per tick (see BATCH_SIZE in the route) — an earlier
  // unbounded version processed the whole catalog per tick and blew the scheduled
  // handler's time/subrequest budget, taking down every job queued after it. Every
  // tick until the catalog is indexed, then no-ops. For the initial backlog, drive
  // scripts/sync-vector-index.mjs against this endpoint to drain it faster.
  { path: "/api/cron/vector-index", secretVar: "ADMIN_SECRET" },
  // Rotates the X/Twitter highlight. Fine every 4h (~6 posts/day).
  { path: "/api/cron/highlight", secretVar: "ADMIN_SECRET" },
  // Purges R2 ISR-cache entries left behind by previous deploys' build IDs,
  // keeping only the current build's — see route comment for why this exists
  // alongside the bucket's 7-day lifecycle rule.
  { path: "/api/cron/isr-cache-cleanup", secretVar: "ADMIN_SECRET" },
  // Supply-chain vulnerability signal: OSV.dev existence-check + severity
  // detail fetch for each listing's install package. Bounded per tick (see
  // BATCH_SIZE/MAX_DETAIL_FETCHES in the route) so unresolved listings simply
  // roll to the next tick instead of blowing the scheduled handler's budget.
  { path: "/api/cron/vuln-scan", secretVar: "ADMIN_SECRET" },
  // IndexNow catch-up for recently changed URLs — daily at 00:00 UTC tick.
  // Change-scoped (submits nothing on a quiet day) so the key stays out of
  // Bing's "batch mode". Complements the per-approve ping so fire-and-forget
  // misses still get indexed.
  {
    path: "/api/cron/indexnow",
    secretVar: "ADMIN_SECRET",
    shouldRun: (now) => now.getUTCHours() === 0,
  },
  // "This week on AllMCPs" digest — weekly, not every 4h, or it would send a
  // campaign on every tick. Runs on the Monday 12:00 UTC tick only.
  {
    path: "/api/cron/newsletter-digest",
    secretVar: "ADMIN_SECRET",
    shouldRun: (now) => now.getUTCDay() === 1 && now.getUTCHours() === 12,
  },
  // One-time "complete your purchase" email for sponsor-ad checkouts abandoned
  // 2+ days ago. Daily (not every 4h) so a given ad's reminder window doesn't
  // get scanned repeatedly the same day — the route is idempotent regardless
  // (abandonedReminderSentAt gates re-sends), this just avoids the extra work.
  {
    path: "/api/cron/ad-checkout-reminder",
    secretVar: "ADMIN_SECRET",
    shouldRun: (now) => now.getUTCHours() === 8,
  },
  // Promotes ingested (never human-submitted) pending listings to active once
  // they've sat untouched for a week and a fresh liveness check still finds
  // them alive — see the route for the full policy. Daily is plenty; the
  // dwell window is measured in days, not hours.
  {
    path: "/api/cron/auto-promote",
    secretVar: "ADMIN_SECRET",
    shouldRun: (now) => now.getUTCHours() === 5,
  },
];

async function runCronJob(
  job: CronJob,
  env: CloudflareEnv,
  ctx: ExecutionContext,
): Promise<void> {
  // Secrets live on the runtime env even though they aren't in the generated
  // `CloudflareEnv` type (same values the routes read via `process.env`).
  const secret = (env as unknown as Record<string, string | undefined>)[
    job.secretVar
  ];
  if (!secret) {
    console.error(
      `[cron] Skipping ${job.path}: ${job.secretVar} is not configured`,
    );
    return;
  }

  const request = new Request(`https://allmcps.com${job.path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });

  try {
    const response = await handler.fetch(request, env, ctx);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `[cron] ${job.path} responded ${response.status}: ${body.slice(0, 500)}`,
      );
    } else {
      console.log(`[cron] ${job.path} ok (${response.status})`);
    }
  } catch (error) {
    console.error(`[cron] ${job.path} threw`, error);
  }
}

export default {
  fetch: handler.fetch,

  async scheduled(
    controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext,
  ): Promise<void> {
    const now = new Date(controller.scheduledTime);

    // `controller.cron` is the pattern (from wrangler.jsonc) that fired this
    // tick, so each schedule only runs its own job list — otherwise the two
    // triggers would double-run health/enrich every 4h (both patterns match
    // at :00 past the hour on 4h boundaries).
    const jobs = controller.cron === "*/15 * * * *" ? FAST_JOBS : SLOW_JOBS;

    // Run sequentially so overlapping D1 writes / third-party rate limits stay
    // predictable, and so one failing job never blocks the others.
    for (const job of jobs) {
      if (job.shouldRun && !job.shouldRun(now)) continue;
      await runCronJob(job, env, ctx);
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
