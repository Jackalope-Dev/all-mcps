import { execSync } from 'node:child_process';

/**
 * One-off IndexNow catch-up for the 2026-09-07 registry-sync incident.
 *
 * Every row from that incident's ingest run landed via a raw SQL INSERT/UPDATE
 * (both the original 4,368 auto-active listings and the 7,677 rows this
 * session's repair-recheck-pending.mjs later promoted from wrongly-demoted
 * 'pending') — neither path goes through the API route that fires
 * lib/indexnow.ts's notifyListingIndexed(), so none of them ever got pinged.
 * The daily /api/cron/indexnow safety net only pulls the 40 most-recently-
 * created active listings per run, which would take ~300 days to cover a
 * burst this size. This submits all of them directly, once.
 *
 * IndexNow's documented per-request cap is 10,000 URLs; chunks conservatively
 * below that to keep each POST body small and retryable.
 */

const DB_NAME = 'all-mcps';
const ACCOUNT_ID = '1a04a617cf42aaaba19b44365dd7c882';
const WRANGLER_ENV = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };

const INDEXNOW_KEY = 'c7fa82e1d09b4f658a2e3f4b5c6d7e8f';
const HOST = 'allmcps.com';
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

// Matches the window used by scripts/repair-recheck-pending.mjs — every row
// from the 2026-09-07 incident's ingest run falls inside it.
const INCIDENT_WINDOW_START = 1788766800;
const INCIDENT_WINDOW_END = 1788780000;

const CHUNK_SIZE = 5000;

function queryIds() {
  const cmd =
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command ` +
    `"SELECT id FROM servers WHERE status='active' AND created_at BETWEEN ${INCIDENT_WINDOW_START} AND ${INCIDENT_WINDOW_END}"`;
  const out = execSync(cmd, {
    cwd: process.cwd(),
    env: WRANGLER_ENV,
    maxBuffer: 1024 * 1024 * 50,
  }).toString();
  return (JSON.parse(out)[0]?.results ?? []).map((r) => r.id);
}

async function submitChunk(urlList) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    }),
  });
  return res;
}

async function main() {
  const ids = queryIds();
  console.log(`Found ${ids.length} active listings from the incident window.`);
  if (ids.length === 0) return;

  const urls = ids.map((id) => `https://${HOST}/mcp/${id}`);
  let submitted = 0;
  let failed = 0;
  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE);
    const res = await submitChunk(chunk);
    if (res.status === 200 || res.status === 202) {
      submitted += chunk.length;
      console.log(`  Submitted ${chunk.length} URLs (status ${res.status}).`);
    } else {
      failed += chunk.length;
      const text = await res.text().catch(() => '');
      console.error(
        `  Chunk failed (status ${res.status}): ${text.slice(0, 200)}`,
      );
    }
  }
  console.log(`Done. ${submitted} submitted, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
