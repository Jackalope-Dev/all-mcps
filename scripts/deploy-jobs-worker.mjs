import { spawnSync } from 'node:child_process';

/**
 * Deploys the background-jobs Worker (`all-mcps-jobs`, wrangler.jsonc
 * `env.jobs`) from the build `opennextjs-cloudflare build` just produced.
 * `deploy:cf` runs this *before* deploying the site so both Workers always
 * ship the same build, and so the site's JOBS service binding never points
 * at a Worker that doesn't exist yet.
 *
 * Plain `wrangler deploy` rather than `opennextjs-cloudflare deploy --env jobs`:
 * the site deploy right after this already uploads the build's ISR seed to R2,
 * and this Worker never serves pages. OPEN_NEXT_DEPLOY tells wrangler it's
 * being driven from an OpenNext deploy, so it doesn't hand off to
 * `opennextjs-cloudflare deploy` itself (what that command sets for the same
 * reason).
 *
 * Never fails the deploy: a failed jobs deploy leaves the previous jobs
 * version running (crons keep going), and the site still has to ship.
 */
// Workers Builds sets these for the Worker the repo is connected to (the site,
// `all-mcps`). WRANGLER_CI_OVERRIDE_NAME makes *every* `wrangler deploy` in the
// build upload under that name regardless of config, which pushed this jobs
// config (WORKER_ROLE=jobs) at the live site Worker; WRANGLER_CI_MATCH_TAG then
// rejects any Worker other than the connected one. Neither applies to this
// second Worker, so drop both for this child process only.
const env = { ...process.env, OPEN_NEXT_DEPLOY: 'true' };
delete env.WRANGLER_CI_OVERRIDE_NAME;
delete env.WRANGLER_CI_MATCH_TAG;

const result = spawnSync('npx', ['wrangler', 'deploy', '--env', 'jobs'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
});

if (result.status !== 0) {
  console.warn(
    `\n⚠️  Jobs Worker deploy failed (exit ${result.status ?? result.error?.message}). ` +
      'Continuing with the site deploy; the previous all-mcps-jobs version keeps running.\n',
  );
}
