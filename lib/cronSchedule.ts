/**
 * Cron job tables and the site/jobs Worker split, kept free of the OpenNext
 * build import so it can be unit-tested. custom-worker.ts dispatches these.
 */

export type CronJob = {
  /** Route to invoke (POST). */
  path: string;
  /**
   * Name of the Worker secret whose value authorizes this route as
   * `Authorization: Bearer <secret>`. This is a runtime secret, not part of
   * the generated `CloudflareEnv` type, so we read it dynamically.
   *
   * Every route checks this via `isCronAuthorized` (lib/cronAuth.ts), which
   * accepts `CRON_SECRET` and `ADMIN_SECRET` side by side while the rename is
   * in flight. It grants cron access only — admin routes are gated on the
   * `role` column, not on any secret.
   */
  secretVar: 'CRON_SECRET';
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
export const FAST_JOBS: CronJob[] = [
  // Rechecks listing health, badges, stars and npm downloads.
  { path: '/api/cron/health', secretVar: 'CRON_SECRET' },
  // Catalog quality: website/homepage, logos, install hints, clean scrape chrome,
  // unpublish archived/404 GitHub repos. Every tick until the catalog is enriched.
  { path: '/api/cron/enrich', secretVar: 'CRON_SECRET' },
];

// Runs every 20 min ("*/20 * * * *") when a single Worker does everything —
// own schedule so GPT writeups don't sit behind the 4h slow list or block
// 15-min health/enrich. Default batch (6) because it shares the isolate with
// live page traffic.
export const AI_CONTENT_JOBS: CronJob[] = [
  { path: '/api/cron/ai-content', secretVar: 'CRON_SECRET' },
];

// What the site's 20-min ai-content tick sends to the dedicated jobs Worker.
// Nothing else shares that isolate, so it takes the route's max batch (same
// 6-wide concurrency per wave, just more waves), several times back to back:
// claims are atomic, so each run takes the next 24. Sized from production: a
// batch-24 run takes ~100s, so 6 runs (~10 min, 144 listings per tick) finish
// well inside the 15-min cron wall limit and before the next tick. Runs stay
// sequential so one isolate's peak memory is still a single run's. Raising the
// run count, not the cadence, avoids depending on a new cron pattern
// (Cloudflare kept firing the old "*/20" for over an hour after the site's
// schedule was changed to "*/10", and never fired the jobs Worker's own).
export const AI_CONTENT_DEDICATED_RUNS = 6;
export const AI_CONTENT_JOBS_DEDICATED: CronJob[] = Array.from(
  { length: AI_CONTENT_DEDICATED_RUNS },
  () => ({
    path: '/api/cron/ai-content?batchSize=24',
    secretVar: 'CRON_SECRET',
  }),
);

// Must run on the Worker that serves pages. It deletes every ISR-cache prefix
// except the *running* build's (process.env.OPEN_NEXT_BUILD_ID), so on any
// other Worker a build-ID mismatch would wipe the site's live page cache.
// Purges R2 ISR-cache entries left behind by previous deploys' build IDs —
// see the route comment for why this exists alongside the bucket's 7-day
// lifecycle rule.
export const SITE_JOBS: CronJob[] = [
  { path: '/api/cron/isr-cache-cleanup', secretVar: 'CRON_SECRET' },
];

// Runs every 4h (wrangler.jsonc "0 */4 * * *").
export const SLOW_JOBS: CronJob[] = [
  // FAQ backfill for listings enriched before ai-content started generating FAQ
  // pairs. Every tick until the backlog is drained, then permanently no-ops. For
  // the initial backlog, drive scripts/backfill-ai-faq.mjs to drain it faster.
  { path: '/api/cron/ai-faq', secretVar: 'CRON_SECRET' },
  // Syncs semantic vector embeddings into Cloudflare Vectorize for natural language
  // search. Bounded batch per tick (see BATCH_SIZE in the route) — an earlier
  // unbounded version processed the whole catalog per tick and blew the scheduled
  // handler's time/subrequest budget, taking down every job queued after it. Every
  // tick until the catalog is indexed, then no-ops. For the initial backlog, drive
  // scripts/sync-vector-index.mjs against this endpoint to drain it faster.
  { path: '/api/cron/vector-index', secretVar: 'CRON_SECRET' },
  // Supply-chain vulnerability signal: OSV.dev existence-check + severity
  // detail fetch for each listing's install package. Bounded per tick (see
  // BATCH_SIZE/MAX_DETAIL_FETCHES in the route) so unresolved listings simply
  // roll to the next tick instead of blowing the scheduled handler's budget.
  { path: '/api/cron/vuln-scan', secretVar: 'CRON_SECRET' },
  // IndexNow catch-up for recently changed URLs — daily at 00:00 UTC tick.
  // Change-scoped (submits nothing on a quiet day) so the key stays out of
  // Bing's "batch mode". Complements the per-approve ping so fire-and-forget
  // misses still get indexed.
  {
    path: '/api/cron/indexnow',
    secretVar: 'CRON_SECRET',
    shouldRun: (now) => now.getUTCHours() === 0,
  },
  // "This week on AllMCPs" digest — weekly, not every 4h, or it would send a
  // campaign on every tick. Runs on the Monday 12:00 UTC tick only.
  {
    path: '/api/cron/newsletter-digest',
    secretVar: 'CRON_SECRET',
    shouldRun: (now) => now.getUTCDay() === 1 && now.getUTCHours() === 12,
  },
  // One-time "complete your purchase" email for sponsor-ad checkouts abandoned
  // 2+ days ago. Daily (not every 4h) so a given ad's reminder window doesn't
  // get scanned repeatedly the same day — the route is idempotent regardless
  // (abandonedReminderSentAt gates re-sends), this just avoids the extra work.
  {
    path: '/api/cron/ad-checkout-reminder',
    secretVar: 'CRON_SECRET',
    shouldRun: (now) => now.getUTCHours() === 8,
  },
  // Promotes ingested (never human-submitted) pending listings to active once
  // they've sat untouched for a week and a fresh liveness check still finds
  // them alive — see the route for the full policy. Daily is plenty; the
  // dwell window is measured in days, not hours.
  {
    path: '/api/cron/auto-promote',
    secretVar: 'CRON_SECRET',
    shouldRun: (now) => now.getUTCHours() === 5,
  },
  // 45-day retention cleanup for impression_logs and api_access_logs to prevent
  // unbounded table/index growth and D1 Time-Travel WAL storage bloat. Daily at 03:00 UTC.
  {
    path: '/api/cron/log-cleanup',
    secretVar: 'CRON_SECRET',
    shouldRun: (now) => now.getUTCHours() === 3,
  },
  // Blog content pipeline: corpus sync, topic dedupe, draft → self-review →
  // revise (lib/blogPipeline). Deliberately LAST — it spends up to ~9 min of
  // its own time budget on LLM calls, so everything above runs first. Stops
  // itself once BACKLOG_CAP drafts are waiting for review in /admin → Blog Drafts.
  { path: '/api/cron/blog-pipeline', secretVar: 'CRON_SECRET' },
];

/**
 * Which half of the split this deployment is (WORKER_ROLE var, wrangler.jsonc):
 * - `site`: serves allmcps.com and owns every cron schedule, but only runs
 *   SITE_JOBS itself. Every other job, scheduled or requested over HTTP, is
 *   sent to the jobs Worker over the JOBS service binding.
 * - `jobs`: the `all-mcps-jobs` Worker (`env.jobs`). No cron triggers of its
 *   own (they never fired for it, and one scheduler can't double-run); it
 *   executes whatever the site sends and serves nothing but /api/cron/*, so
 *   LLM batches and backfills never share an isolate with page traffic.
 * - unset: a single Worker doing both, as before the split.
 */
export type WorkerRole = 'site' | 'jobs' | 'all';

/**
 * Secrets the jobs Worker's cron routes read. The site Worker hands these to it
 * over the SITE_SECRETS RPC binding (SecretRelay in custom-worker.ts), so they
 * live in one place and never need re-entering per Worker. Allowlist only:
 * nothing else the site holds (Stripe, auth, Turnstile, ...) crosses over.
 */
export const JOB_SECRET_NAMES = [
  'CRON_SECRET',
  'ADMIN_SECRET',
  'OPEN_AI_API_KEY',
  'GITHUB_TOKEN',
  'RESEND_API_KEY',
  'SEQUENZY_API_KEY',
  'SEQUENZY_CAMPAIGNS_API_KEY',
  'BLOG_PUBLISH_TOKEN',
  'LOPEBASE_SIGNING_SECRET',
] as const;

export type SecretRelayStub = {
  jobSecrets(): Promise<Record<string, string>>;
};

export type RoleEnv = {
  WORKER_ROLE?: string;
  JOBS?: Fetcher;
  SITE_SECRETS?: SecretRelayStub;
};

/** Picks the allowlisted job secrets that are set (non-empty strings) on `env`. */
export function pickJobSecrets(env: unknown): Record<string, string> {
  const source = (env ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const name of JOB_SECRET_NAMES) {
    const value = source[name];
    if (typeof value === 'string' && value !== '') out[name] = value;
  }
  return out;
}

/**
 * `env` plus any relayed secret it doesn't already have. A secret set directly
 * on the jobs Worker wins over the relayed copy; non-allowlisted keys in
 * `relayed` are ignored.
 */
export function mergeRelayedSecrets<E extends object>(
  env: E,
  relayed: Record<string, string>,
): E {
  const own = env as Record<string, unknown>;
  const missing = Object.fromEntries(
    Object.entries(pickJobSecrets(relayed)).filter(
      ([name]) => typeof own[name] !== 'string' || own[name] === '',
    ),
  );
  return Object.keys(missing).length > 0 ? { ...env, ...missing } : env;
}

export function workerRole(env: unknown): WorkerRole {
  const role = (env as RoleEnv | undefined)?.WORKER_ROLE;
  return role === 'site' || role === 'jobs' ? role : 'all';
}

export function jobsForTick(cron: string, role: WorkerRole): CronJob[] {
  // The jobs Worker has no schedules; this only matters if one is ever added.
  if (role === 'jobs') return [];
  switch (cron) {
    case '*/15 * * * *':
      return FAST_JOBS;
    // The big batches only make sense when they execute on the jobs Worker,
    // i.e. the site config that schedules them (WORKER_ROLE=site) also binds
    // JOBS. A single Worker keeps the default batch it shares with pages.
    case '*/20 * * * *':
      return role === 'site' ? AI_CONTENT_JOBS_DEDICATED : AI_CONTENT_JOBS;
    case '0 */4 * * *':
      return [...SITE_JOBS, ...SLOW_JOBS];
    default:
      // A pattern no longer (or not yet) in wrangler.jsonc, e.g. Cloudflare
      // firing a stale schedule after a change. Run nothing rather than
      // guess: falling through to the slow list would run 4-hourly jobs on
      // whatever cadence the stray pattern has.
      console.warn(`[cron] no jobs for unrecognized schedule "${cron}"`);
      return [];
  }
}

/** /api/cron/* routes the site Worker hands to the jobs Worker. */
export function isOffloadedCronPath(pathname: string): boolean {
  const path = pathname.split('?')[0];
  return (
    path.startsWith('/api/cron/') && !SITE_JOBS.some((job) => job.path === path)
  );
}
