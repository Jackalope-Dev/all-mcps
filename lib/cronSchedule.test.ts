import { describe, expect, it } from 'vitest';
import {
  AI_CONTENT_JOBS,
  AI_CONTENT_JOBS_DEDICATED,
  FAST_JOBS,
  isOffloadedCronPath,
  JOB_SECRET_NAMES,
  jobsForTick,
  mergeRelayedSecrets,
  pickJobSecrets,
  SITE_JOBS,
  SLOW_JOBS,
  workerRole,
} from './cronSchedule';

const paths = (jobs: { path: string }[]) => jobs.map((j) => j.path);
const ISR_CLEANUP = '/api/cron/isr-cache-cleanup';

describe('workerRole', () => {
  it('defaults to the single-Worker role when WORKER_ROLE is unset or unknown', () => {
    expect(workerRole({})).toBe('all');
    expect(workerRole({ WORKER_ROLE: 'nope' })).toBe('all');
    expect(workerRole({ WORKER_ROLE: 'site' })).toBe('site');
    expect(workerRole({ WORKER_ROLE: 'jobs' })).toBe('jobs');
  });
});

describe('jobsForTick', () => {
  it('schedules every job on the site, including the site-only cache cleanup', () => {
    expect(jobsForTick('*/15 * * * *', 'site')).toBe(FAST_JOBS);
    expect(jobsForTick('*/20 * * * *', 'site')).toBe(AI_CONTENT_JOBS_DEDICATED);
    expect(paths(jobsForTick('0 */4 * * *', 'site'))).toEqual(
      paths([...SITE_JOBS, ...SLOW_JOBS]),
    );
    expect(paths(SITE_JOBS)).toEqual([ISR_CLEANUP]);
  });

  it('never runs anything from the jobs Worker schedule', () => {
    for (const cron of ['0 */4 * * *', '*/15 * * * *', '*/20 * * * *']) {
      expect(jobsForTick(cron, 'jobs')).toEqual([]);
    }
  });

  it('sends one batch-24 AI run plus install-only runs from the site, but keeps the default batch on a single Worker', () => {
    expect(paths(AI_CONTENT_JOBS_DEDICATED)).toEqual([
      '/api/cron/ai-content?batchSize=24',
      ...Array(16).fill('/api/cron/ai-content?pass=install&batchSize=24'),
    ]);
    for (const job of AI_CONTENT_JOBS_DEDICATED) {
      expect(isOffloadedCronPath(job.path)).toBe(true);
    }
    // Only the install-only runs stop early once one reports the backlog empty.
    expect(AI_CONTENT_JOBS_DEDICATED.map((j) => Boolean(j.drainable))).toEqual([
      false,
      ...Array(16).fill(true),
    ]);
    expect(jobsForTick('*/20 * * * *', 'all')).toBe(AI_CONTENT_JOBS);
  });

  it('runs nothing for a schedule it does not recognize', () => {
    expect(jobsForTick('*/10 * * * *', 'site')).toEqual([]);
    expect(jobsForTick('*/10 * * * *', 'all')).toEqual([]);
  });

  it('keeps the blog pipeline last in the slow list (it spends ~9 min of budget)', () => {
    for (const role of ['site', 'all'] as const) {
      const slow = paths(jobsForTick('0 */4 * * *', role));
      expect(slow.at(-1)).toBe('/api/cron/blog-pipeline');
    }
  });
});

describe('isOffloadedCronPath', () => {
  it('forwards cron routes except the site-only ones', () => {
    expect(isOffloadedCronPath('/api/cron/ai-content')).toBe(true);
    expect(isOffloadedCronPath('/api/cron/stdio-verify/result')).toBe(true);
    expect(isOffloadedCronPath('/api/cron/ai-content?batchSize=24')).toBe(true);
    expect(isOffloadedCronPath(ISR_CLEANUP)).toBe(false);
    expect(isOffloadedCronPath('/api/admin/crons')).toBe(false);
    expect(isOffloadedCronPath('/mcp/foo')).toBe(false);
  });

  it('covers every job the jobs Worker runs', () => {
    for (const job of [
      ...FAST_JOBS,
      ...AI_CONTENT_JOBS,
      ...AI_CONTENT_JOBS_DEDICATED,
      ...SLOW_JOBS,
    ]) {
      expect(isOffloadedCronPath(job.path)).toBe(true);
    }
    for (const job of SITE_JOBS) {
      expect(isOffloadedCronPath(job.path)).toBe(false);
    }
  });
});

describe('secret relay', () => {
  it('only relays allowlisted, non-empty secrets', () => {
    expect(
      pickJobSecrets({
        CRON_SECRET: 'c',
        OPEN_AI_API_KEY: 'o',
        GITHUB_TOKEN: '',
        STRIPE_SECRET_KEY: 's',
        AUTH_SECRET: 'a',
        DB: { binding: true },
      }),
    ).toEqual({ CRON_SECRET: 'c', OPEN_AI_API_KEY: 'o' });
    expect(JOB_SECRET_NAMES).not.toContain('STRIPE_SECRET_KEY');
  });

  it('relays the Jev key, which stale-sweep triage needs on the jobs Worker', () => {
    expect(JOB_SECRET_NAMES).toContain('TYPESAFE_API_KEY');
  });

  it('fills only what the jobs Worker lacks and never drops its own bindings', () => {
    const db = { prepare() {} };
    const merged = mergeRelayedSecrets(
      { DB: db, CRON_SECRET: 'own', WORKER_ROLE: 'jobs' },
      { CRON_SECRET: 'site', OPEN_AI_API_KEY: 'k', STRIPE_SECRET_KEY: 'x' },
    ) as Record<string, unknown>;
    expect(merged.CRON_SECRET).toBe('own');
    expect(merged.OPEN_AI_API_KEY).toBe('k');
    expect(merged.STRIPE_SECRET_KEY).toBeUndefined();
    expect(merged.DB).toBe(db);
    expect(merged.WORKER_ROLE).toBe('jobs');
  });

  it('returns env untouched when nothing is missing', () => {
    const env = { CRON_SECRET: 'own' };
    expect(mergeRelayedSecrets(env, { CRON_SECRET: 'site' })).toBe(env);
  });
});

describe('catalog sourcing jobs', () => {
  const due = (iso: string) =>
    FAST_JOBS.filter((j) => !j.shouldRun || j.shouldRun(new Date(iso))).map(
      (j) => j.path,
    );
  const ingest = (iso: string) =>
    due(iso).filter((p) => p.startsWith('/api/cron/ingest'));

  it('ingests the registry every 4h at :30 and catches up once a day', () => {
    expect(ingest('2026-10-14T01:30:00Z')).toEqual([
      '/api/cron/ingest?source=registry&hours=6',
    ]);
    expect(ingest('2026-10-14T07:30:00Z')).toEqual([
      '/api/cron/ingest?source=registry&hours=30',
    ]);
  });

  it('runs each other source once a day, never on the :00 tick', () => {
    expect(ingest('2026-10-14T02:30:00Z')).toEqual([
      '/api/cron/ingest?source=awesome',
    ]);
    expect(ingest('2026-10-14T03:30:00Z')).toEqual([
      '/api/cron/ingest?source=npm',
    ]);
    expect(ingest('2026-10-14T04:30:00Z')).toEqual([
      '/api/cron/ingest?source=github',
    ]);
    expect(ingest('2026-10-14T02:00:00Z')).toEqual([]);
    expect(ingest('2026-10-14T02:45:00Z')).toEqual([]);
  });

  it('sweeps near-duplicates on Sundays only', () => {
    expect(due('2026-10-18T06:30:00Z')).toContain('/api/cron/dedupe');
    expect(due('2026-10-14T06:30:00Z')).not.toContain('/api/cron/dedupe');
  });

  it('keeps health, enrich and stale-sweep on every fast tick', () => {
    expect(due('2026-10-14T05:15:00Z')).toEqual([
      '/api/cron/health',
      '/api/cron/enrich',
      '/api/cron/stale-sweep',
    ]);
  });

  it('auto-promotes on every slow tick', () => {
    const job = SLOW_JOBS.find((j) => j.path === '/api/cron/auto-promote');
    expect(job).toBeDefined();
    expect(job?.shouldRun).toBeUndefined();
  });

  it('offloads the new routes to the jobs Worker', () => {
    expect(isOffloadedCronPath('/api/cron/ingest?source=npm')).toBe(true);
    expect(isOffloadedCronPath('/api/cron/dedupe')).toBe(true);
  });
});
