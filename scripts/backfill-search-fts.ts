/**
 * Fills the servers_fts trigram search index (drizzle/0065_search_fts.sql) from
 * existing servers rows, then marks it ready so search switches over from the
 * LIKE scan (lib/searchFts.ts). Rows written after the migration are already
 * kept in sync by its triggers; this only covers rows that predate it.
 *
 * Runs in rowid chunks, one `wrangler d1 execute --command` each, so no single D1
 * statement indexes more than --chunk rows. Every chunk deletes then re-inserts
 * its rowid range, so re-running the whole script or one chunk is safe. The ready
 * row is written only once the index row count matches servers.
 *
 * Usage (apply the migration first):
 *   npx tsx scripts/backfill-search-fts.ts --local [--persist-to=<dir>]
 *   npx tsx scripts/backfill-search-fts.ts --remote [--chunk=1000] [--from=<rowid>] [--dry-run]
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { ftsBackfillSql, ftsReadySql } from '../lib/searchFts';

const DB_NAME = 'all-mcps';
// wrangler.jsonc has no `account_id`, and this Cloudflare login has more than one
// account, so a non-interactive `wrangler d1` call fails closed (7403) without this.
// Same value as scripts/ingest-sources.mjs.
const ACCOUNT_ID = '1a04a617cf42aaaba19b44365dd7c882';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const target = flag('remote') ? '--remote' : flag('local') ? '--local' : null;
if (!target) {
  console.error('Pass --local or --remote.');
  process.exit(1);
}
const dryRun = flag('dry-run');
// Local runs only: point at a different miniflare state dir, e.g. a scratch copy.
const persistTo = option('persist-to');
const chunk = Number(option('chunk') ?? 1000);
if (!Number.isInteger(chunk) || chunk < 1) {
  console.error('--chunk must be a positive integer.');
  process.exit(1);
}

// Node + wrangler's JS entry directly: no shell, so the SQL needs no quoting.
const wranglerBin = path.join(
  path.dirname(createRequire(import.meta.url).resolve('wrangler/package.json')),
  'bin',
  'wrangler.js',
);

function d1<T>(sql: string): T[] {
  const out = execFileSync(
    process.execPath,
    [
      wranglerBin,
      'd1',
      'execute',
      DB_NAME,
      target as string,
      ...(persistTo ? [`--persist-to=${persistTo}`] : []),
      '--json',
      '--command',
      sql,
    ],
    {
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
      maxBuffer: 1024 * 1024 * 20,
    },
  ).toString();
  const parsed = JSON.parse(out) as Array<{ results?: T[] }>;
  return parsed.flatMap((r) => r.results ?? []);
}

function main() {
  const [table] = d1<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'servers_fts'",
  );
  if (!table) {
    console.error(
      `servers_fts is missing. Apply the migration first:\n  npx wrangler d1 execute ${DB_NAME} ${target} --file=drizzle/0065_search_fts.sql`,
    );
    process.exit(1);
  }

  const [range] = d1<{ lo: number | null; hi: number | null; n: number }>(
    'SELECT min(rowid) AS lo, max(rowid) AS hi, count(*) AS n FROM servers',
  );
  if (range?.lo == null || range.hi == null) {
    console.log('servers is empty; nothing to backfill.');
    return;
  }
  const start = Number(option('from') ?? range.lo);
  console.log(
    `${range.n} servers rows, rowid ${range.lo}..${range.hi}; indexing from ${start} in chunks of ${chunk}.`,
  );

  for (let from = start; from <= range.hi; from += chunk) {
    const to = Math.min(from + chunk - 1, range.hi);
    const sql = ftsBackfillSql(from, to).replace(/\s*\n\s*/g, ' ');
    if (dryRun) {
      console.log(sql);
      continue;
    }
    const t = Date.now();
    d1(sql);
    console.log(`  rowid ${from}..${to} indexed (${Date.now() - t}ms)`);
  }
  if (dryRun) return;

  const [check] = d1<{ missing: number }>(
    'SELECT count(*) AS missing FROM servers s WHERE NOT EXISTS (SELECT 1 FROM servers_fts f WHERE f.rowid = s.rowid AND f.id = s.id)',
  );
  if (check?.missing !== 0) {
    console.error(
      `${check?.missing} servers rows are not indexed; not marking ready. Re-run (optionally with --from=<rowid>).`,
    );
    process.exit(1);
  }
  d1(ftsReadySql(Math.floor(Date.now() / 1000)));
  console.log(
    `Every servers row is indexed; set job_cursors 'search_fts_ready'. Workers switch to the index within ~5 minutes.`,
  );
}

main();
