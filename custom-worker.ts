// Custom Worker entrypoint.
//
// OpenNext generates `.open-next/worker.js`, which only exports a `fetch`
// handler. Our `wrangler.jsonc` also declares a cron trigger ("0 */4 * * *"),
// and Cloudflare invokes cron triggers through a `scheduled()` handler. Because
// the generated worker has no `scheduled()` export, every cron tick failed with
// "Handler does not export a scheduled() function".
//
// This wrapper re-exports OpenNext's `fetch` unchanged and adds a `scheduled()`
// handler that re-dispatches each cron job back through the same in-process
// Next.js handler, so the existing `/api/cron/*` routes keep owning the logic.
// `wrangler.jsonc` `main` points here instead of at `.open-next/worker.js`.

// @ts-expect-error `.open-next/worker.js` is generated at build time.
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
   * Optional gate. The cron fires every 4 hours; jobs without a gate run on
   * every tick. Jobs with a gate only run on ticks where it returns true.
   */
  shouldRun?: (now: Date) => boolean;
};

const CRON_JOBS: CronJob[] = [
  // Rechecks listing health, badges, stars and npm downloads. Fine every 4h.
  { path: "/api/cron/health", secretVar: "ADMIN_SECRET" },
  // Rotates the X/Twitter highlight. Fine every 4h (~6 posts/day).
  { path: "/api/cron/highlight", secretVar: "ADMIN_SECRET" },
  // IndexNow batch for recently approved listings — daily at 00:00 UTC tick.
  // Complements the per-approve ping so fire-and-forget misses still get indexed.
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

    // Run sequentially so overlapping D1 writes / third-party rate limits stay
    // predictable, and so one failing job never blocks the others.
    for (const job of CRON_JOBS) {
      if (job.shouldRun && !job.shouldRun(now)) continue;
      await runCronJob(job, env, ctx);
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
