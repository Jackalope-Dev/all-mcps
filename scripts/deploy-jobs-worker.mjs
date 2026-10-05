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
const result = spawnSync('npx', ['wrangler', 'deploy', '--env', 'jobs'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, OPEN_NEXT_DEPLOY: 'true' },
});

if (result.status !== 0) {
  console.warn(
    `\n⚠️  Jobs Worker deploy failed (exit ${result.status ?? result.error?.message}). ` +
      'Continuing with the site deploy; the previous all-mcps-jobs version keeps running.\n',
  );
}
