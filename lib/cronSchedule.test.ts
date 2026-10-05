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
    expect(jobsForTick('*/10 * * * *', 'site')).toBe(AI_CONTENT_JOBS_DEDICATED);
    expect(paths(jobsForTick('0 */4 * * *', 'site'))).toEqual(
      paths([...SITE_JOBS, ...SLOW_JOBS]),
    );
    expect(paths(SITE_JOBS)).toEqual([ISR_CLEANUP]);
  });

  it('never runs anything from the jobs Worker schedule', () => {
    for (const cron of ['0 */4 * * *', '*/15 * * * *', '*/10 * * * *']) {
      expect(jobsForTick(cron, 'jobs')).toEqual([]);
    }
  });

  it('runs batch 24 on the 10-min tick and the default batch on the shared 20-min one', () => {
    expect(paths(AI_CONTENT_JOBS_DEDICATED)).toEqual([
      '/api/cron/ai-content?batchSize=24',
    ]);
    expect(jobsForTick('*/20 * * * *', 'all')).toBe(AI_CONTENT_JOBS);
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
