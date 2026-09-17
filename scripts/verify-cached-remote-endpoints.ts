/**
 * Probe every cached remote endpoint and clear the ones that provably don't speak MCP.
 *
 * `looksLikeMcpEndpointUrl` only tests a URL's *shape*, so a docs or marketing page under
 * an /mcp path clears it — that is how one of the Magic Hour listings ended up advertising
 * https://magichour.ai/mcp (a human-readable connection-docs page) as its connector URL.
 * Thousands of active listings hand clients a URL that was parsed out of README text and
 * that nothing has ever actually connected to.
 *
 * Only listings *without* an owner-set remote_endpoint_url are probed: those already get a
 * real handshake from the health cron, and they're the field an owner controls.
 *
 * The bar for taking an endpoint away is deliberately high (see
 * lib/tools/verifyRemoteEndpoint.ts): an OAuth 401, an SSE stream, or any JSON-RPC answer
 * keeps the row, and timeouts, bot walls and 5xx are inconclusive. Only "served HTML to a
 * JSON-RPC POST" or "404/410" clears it. A wrongly cleared endpoint costs a real server its
 * connection details, which is worse than leaving a doubtful one in place for another pass.
 *
 * Note: clearing install_* removes one of the signals isListingTrulyDead weighs, so a
 * listing whose repo is *also* archived can become eligible for soft-unpublish on a later
 * health sweep. That is the intended reading (dead repo + no working endpoint), and
 * status='removed' is recoverable, but it is why this only ever acts on proof.
 *
 * Writes a reviewable SQL file plus a rollback to drizzle/. Pass --apply to execute it.
 *
 * Usage: npx tsx scripts/verify-cached-remote-endpoints.ts [--apply] [--limit N] [--concurrency N]
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  type EndpointVerdict,
  probeRemoteEndpoint,
} from '../lib/tools/verifyRemoteEndpoint';

const DB_NAME = 'all-mcps';
const STAMP = '2026-09-17';

type Row = {
  id: string;
  name: string;
  install_package: string;
  install_kind: string | null;
  install_command: string | null;
  install_args: string | null;
  install_confidence: string | null;
};

function arg(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sqlStr(v: string | null): string {
  if (v === null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

function fetchRemoteListings(limit: number): Row[] {
  const cmd =
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command ` +
    `"SELECT id, name, install_package, install_kind, install_command, install_args, ` +
    `install_confidence FROM servers WHERE status = 'active' AND install_kind = 'remote' ` +
    `AND install_package IS NOT NULL AND remote_endpoint_url IS NULL LIMIT ${limit}"`;
  const out = execSync(cmd, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 200,
  }).toString();
  return (JSON.parse(out)[0]?.results ?? []) as Row[];
}

/** Probe rows with a bounded number of in-flight requests. */
async function probeAll(
  rows: Row[],
  concurrency: number,
): Promise<Map<string, { verdict: EndpointVerdict; detail: string }>> {
  const results = new Map<
    string,
    { verdict: EndpointVerdict; detail: string }
  >();
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      const result = await probeRemoteEndpoint(row.install_package);
      results.set(row.id, result);
      done++;
      if (done % 100 === 0 || done === rows.length) {
        console.log(`  probed ${done}/${rows.length}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, worker),
  );
  return results;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const limit = arg('--limit', 10000);
  const concurrency = arg('--concurrency', 12);

  console.log('Fetching active listings with a cached remote endpoint...');
  const rows = fetchRemoteListings(limit);
  console.log(`  ${rows.length} to probe (concurrency ${concurrency})`);

  const results = await probeAll(rows, concurrency);

  const dead: Row[] = [];
  const counts: Record<EndpointVerdict, number> = {
    alive: 0,
    'not-mcp': 0,
    unknown: 0,
  };
  const reasons = new Map<string, number>();

  for (const row of rows) {
    const result = results.get(row.id);
    if (!result) continue;
    counts[result.verdict]++;
    if (result.verdict === 'not-mcp') {
      dead.push(row);
      reasons.set(result.detail, (reasons.get(result.detail) ?? 0) + 1);
    }
  }

  console.log('\nVerdicts:');
  console.log(`  alive:    ${counts.alive}`);
  console.log(`  not-mcp:  ${counts['not-mcp']}`);
  console.log(`  unknown:  ${counts.unknown} (left untouched)`);
  if (reasons.size > 0) {
    console.log('\nWhy the not-mcp rows failed:');
    for (const [reason, n] of [...reasons.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${String(n).padStart(5)}  ${reason}`);
    }
  }

  // The verdict breakdown is the whole point of a run and it only ever existed on
  // stdout — a backgrounded sweep that took ten minutes lost it to log truncation, and
  // re-probing several thousand third-party hosts to recover a statistic is not a
  // reasonable thing to do to them. Write it down instead.
  const reportPath = path.join(
    process.cwd(),
    'drizzle',
    `report-${STAMP}-unreachable-remote-endpoints.json`,
  );
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        probed: rows.length,
        verdicts: counts,
        reasons: Object.fromEntries(reasons),
        cleared: dead.map((row) => ({
          id: row.id,
          url: row.install_package,
          reason: results.get(row.id)?.detail,
        })),
      },
      null,
      2,
    )}\n`,
  );

  if (dead.length === 0) {
    console.log('\nNothing to clear.');
    return;
  }

  const statements = dead.map(
    (row) =>
      `UPDATE servers SET install_kind = NULL, install_command = NULL, install_args = NULL, ` +
      `install_package = NULL, install_confidence = NULL WHERE id = ${sqlStr(row.id)};`,
  );
  const rollback = dead.map(
    (row) =>
      `UPDATE servers SET install_kind = ${sqlStr(row.install_kind)}, ` +
      `install_command = ${sqlStr(row.install_command)}, ` +
      `install_args = ${sqlStr(row.install_args)}, ` +
      `install_package = ${sqlStr(row.install_package)}, ` +
      `install_confidence = ${sqlStr(row.install_confidence)} ` +
      `WHERE id = ${sqlStr(row.id)};`,
  );

  const outPath = path.join(
    process.cwd(),
    'drizzle',
    `backfill-${STAMP}-unreachable-remote-endpoints.sql`,
  );
  const rollbackPath = path.join(
    process.cwd(),
    'drizzle',
    `rollback-${STAMP}-unreachable-remote-endpoints.sql`,
  );

  fs.writeFileSync(
    outPath,
    `-- Clear cached remote endpoints that a live probe proved are not MCP endpoints:\n` +
      `-- they served HTML to a JSON-RPC POST, or returned 404/410. ${dead.length} of ${rows.length}\n` +
      `-- probed listings. Generated by scripts/verify-cached-remote-endpoints.ts.\n` +
      `-- Inconclusive results (timeouts, bot walls, 5xx) were deliberately left alone.\n\n${statements.join('\n')}\n`,
  );
  fs.writeFileSync(
    rollbackPath,
    `-- ROLLBACK for backfill-${STAMP}-unreachable-remote-endpoints.sql.\n` +
      `-- Restores the cached endpoint for all ${dead.length} rows it cleared.\n\n${rollback.join('\n')}\n`,
  );

  console.log(
    `\nWrote ${statements.length} statements to ${path.relative(process.cwd(), outPath)}`,
  );
  console.log(`  report:   ${path.relative(process.cwd(), reportPath)}`);
  console.log(`  rollback: ${path.relative(process.cwd(), rollbackPath)}`);

  if (!apply) {
    console.log('\nReview the file, then re-run with --apply to execute it.');
    return;
  }

  console.log('\nApplying to the live DB...');
  execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file=${outPath}`, {
    cwd: process.cwd(),
    stdio: 'inherit',
    maxBuffer: 1024 * 1024 * 20,
  });
  console.log('\nDone.');
}

main();
