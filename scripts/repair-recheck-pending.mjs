import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * One-off repair for the 2026-09-07 registry-sync incident: checkLive() in
 * scripts/ingest-sources.mjs used to treat *any* liveness-check failure as
 * "dead", with no retry/backoff and no pacing between batches. Blasting
 * ~13.5k HEAD requests at github.com in ~10 minutes tripped GitHub's
 * abuse/rate-limit protection partway through, and every request after that
 * point failed — so 9,183 of 13,551 genuinely-live official-registry
 * candidates got wrongly demoted from 'active' to 'pending' in one run
 * instead of publishing straight through as intended.
 *
 * This re-checks every currently-pending row created in that run's window
 * using the fixed, retrying/backed-off checkLive() logic and promotes the
 * ones that are actually alive back to 'active'. Rows that are genuinely
 * dead (or still ambiguous after retries) are left in 'pending' for normal
 * admin review — that's the correct outcome for them either way.
 *
 * By default it only writes drizzle/repair-recheck-pending-<date>.sql —
 * review it, then apply:
 *   npx wrangler d1 execute all-mcps --remote --file=drizzle/repair-recheck-pending-<date>.sql
 * Pass --apply to run that automatically.
 */

const AUTO_APPLY = process.argv.includes('--apply');
const DB_NAME = 'all-mcps';
const ACCOUNT_ID = '1a04a617cf42aaaba19b44365dd7c882';
const WRANGLER_ENV = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };

// The bad run's pending rows all landed within this window (confirmed via
// `SELECT min(created_at), max(created_at) FROM servers WHERE status='pending'`
// on 2026-09-07 — every one of the 9,246 pending rows fell inside it, with a
// little padding either side). Scoping to this window means a genuine new
// community submission that lands 'pending' after this repair runs is never
// touched by it.
const INCIDENT_WINDOW_START = 1788766800; // 2026-09-07 ~11:00 UTC
const INCIDENT_WINDOW_END = 1788780000; // 2026-09-07 ~11:20 UTC

const LIVENESS_TIMEOUT_MS = 8000;
const LIVENESS_CONCURRENCY = 4;
const LIVENESS_BATCH_DELAY_MS = 150;
const LIVENESS_RETRIES = 2;
const LIVENESS_RETRY_BASE_DELAY_MS = 500;
const LIVENESS_DEAD_STATUSES = new Set([404, 410, 451]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkLiveOnce(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'AllMCPs-Ingest' },
      signal: AbortSignal.timeout(LIVENESS_TIMEOUT_MS),
    });
    if (res.status === 405 || res.status === 501) {
      const getRes = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'AllMCPs-Ingest' },
        signal: AbortSignal.timeout(LIVENESS_TIMEOUT_MS),
      });
      return { alive: getRes.ok, status: getRes.status };
    }
    return { alive: res.ok, status: res.status };
  } catch {
    return { alive: false, status: null };
  }
}

async function checkLive(url) {
  for (let attempt = 0; attempt <= LIVENESS_RETRIES; attempt++) {
    const result = await checkLiveOnce(url);
    if (result.alive) return true;
    if (result.status !== null && LIVENESS_DEAD_STATUSES.has(result.status)) {
      return false;
    }
    if (attempt < LIVENESS_RETRIES) {
      await sleep(LIVENESS_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  return false;
}

function queryCandidates() {
  const cmd =
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command ` +
    `"SELECT id, url FROM servers WHERE status='pending' AND created_at BETWEEN ${INCIDENT_WINDOW_START} AND ${INCIDENT_WINDOW_END}"`;
  const out = execSync(cmd, {
    cwd: process.cwd(),
    env: WRANGLER_ENV,
    maxBuffer: 1024 * 1024 * 20,
  }).toString();
  return JSON.parse(out)[0]?.results ?? [];
}

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

async function main() {
  const rows = queryCandidates();
  console.log(
    `Re-checking ${rows.length} pending rows from the 2026-09-07 incident window...`,
  );
  if (rows.length === 0) return;

  let aliveCount = 0;
  let checked = 0;
  const aliveIds = [];
  for (let i = 0; i < rows.length; i += LIVENESS_CONCURRENCY) {
    const chunk = rows.slice(i, i + LIVENESS_CONCURRENCY);
    const results = await Promise.all(chunk.map((r) => checkLive(r.url)));
    chunk.forEach((r, idx) => {
      checked++;
      if (results[idx]) {
        aliveCount++;
        aliveIds.push(r.id);
      }
    });
    if (i + LIVENESS_CONCURRENCY < rows.length) {
      await sleep(LIVENESS_BATCH_DELAY_MS);
    }
    if (checked % 500 === 0 || checked === rows.length) {
      console.log(
        `  ${checked}/${rows.length} checked, ${aliveCount} alive so far...`,
      );
    }
  }

  console.log(
    `\n${aliveCount} of ${rows.length} are alive and will be promoted back to 'active'. ` +
      `${rows.length - aliveCount} stay 'pending' (confirmed dead or still unverifiable) for normal admin review.`,
  );
  if (aliveCount === 0) {
    console.log('Nothing to apply.');
    return;
  }

  // D1 caps bound parameters per statement; chunk the IN() list generously
  // (id-only, no other columns) rather than one UPDATE per row.
  const ID_CHUNK_SIZE = 200;
  const statements = [];
  for (let i = 0; i < aliveIds.length; i += ID_CHUNK_SIZE) {
    const chunk = aliveIds.slice(i, i + ID_CHUNK_SIZE);
    const inList = chunk.map((id) => `'${sqlEscape(id)}'`).join(',');
    statements.push(
      `UPDATE servers SET status = 'active' WHERE id IN (${inList});`,
    );
  }
  const sql = `${statements.join('\n')}\n`;

  const date = new Date().toISOString().slice(0, 10);
  const relPath = path.join('drizzle', `repair-recheck-pending-${date}.sql`);
  fs.writeFileSync(relPath, sql);
  console.log(
    `Wrote ${aliveIds.length} promotions (${statements.length} statements) to ${relPath}`,
  );

  if (AUTO_APPLY) {
    console.log('Applying...');
    execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file=${relPath}`, {
      cwd: process.cwd(),
      env: WRANGLER_ENV,
      stdio: 'inherit',
    });
    console.log('Applied.');
  } else {
    console.log(
      `\nReview the file, then apply it with:\n  npx wrangler d1 execute ${DB_NAME} --remote --file=${relPath}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
