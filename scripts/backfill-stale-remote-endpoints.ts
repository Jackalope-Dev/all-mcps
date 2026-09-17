/**
 * One-off backfill: clear cached install hints that treat a plain web page as a remote
 * MCP endpoint.
 *
 * Rows written before the endpoint heuristic was tightened (lib/installConfig.ts →
 * lib/tools/parseInstallHint.ts `looksLikeMcpEndpointUrl`) cached any non-GitHub URL as
 * `install_kind='remote'`, so product homepages, signup pages and docs links sit in
 * `install_package` as if they were endpoints. The cache outranks every other source in
 * resolveInstallConfig, which is how a listing kept rendering one-click install buttons
 * aimed at a marketing page after the heuristic itself was fixed.
 *
 * Live reads already self-heal — fromCached() now re-checks a cached remote URL against
 * the same bar and falls through when it fails — so this is about the stored value, which
 * nothing else clears: the health cron only ever writes install_* when it resolves
 * something, and other consumers (the remote-endpoint liveness probe behind
 * isListingTrulyDead, the vuln scanner's package resolution) read these columns directly.
 *
 * Recomputes each affected row through the actual (fixed) resolveInstallConfig — the same
 * function the app uses at request time. A row is only rewritten when that recompute
 * yields something verified; otherwise it is cleared, never swapped for another guess.
 *
 * Writes a reviewable SQL file to drizzle/. Pass --apply to also run it against the live
 * DB via wrangler; without it the script only writes the file.
 *
 * Usage: npx tsx scripts/backfill-stale-remote-endpoints.ts [--apply]
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  isUnverifiedInstall,
  resolveInstallConfig,
  toCachedInstallFields,
} from '../lib/installConfig';
import { looksLikeMcpEndpointUrl } from '../lib/tools/parseInstallHint';

const DB_NAME = 'all-mcps';
// wrangler.jsonc has no `account_id`, and this Cloudflare login has more than one
// account, so a non-interactive `wrangler d1` call fails closed (7403) without this.
// Same value as scripts/backfill-install-hints.ts.
const ACCOUNT_ID = '1a04a617cf42aaaba19b44365dd7c882';

type Row = {
  id: string;
  name: string;
  url: string;
  description: string;
  remote_endpoint_url: string | null;
  install_kind: string | null;
  install_package: string | null;
};

function sqlStr(v: string | null): string {
  if (v === null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

function fetchRemoteCachedServers(): Row[] {
  const cmd =
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command ` +
    `"SELECT id, name, url, description, remote_endpoint_url, install_kind, install_package ` +
    `FROM servers WHERE install_kind = 'remote'"`;
  const out = execSync(cmd, {
    cwd: process.cwd(),
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
    maxBuffer: 1024 * 1024 * 100,
  }).toString();
  const parsed = JSON.parse(out);
  return (parsed[0]?.results ?? []) as Row[];
}

function main() {
  const apply = process.argv.includes('--apply');

  console.log("Fetching servers cached as install_kind='remote'...");
  const all = fetchRemoteCachedServers();
  console.log(`  ${all.length} rows cached as remote`);

  const affected = all.filter(
    (r) => !looksLikeMcpEndpointUrl(r.install_package || ''),
  );
  console.log(
    `  ${affected.length} of them cache a URL that is not endpoint-shaped`,
  );

  const statements: string[] = [];
  let persisted = 0;
  let cleared = 0;

  for (const row of affected) {
    const resolved = resolveInstallConfig({
      id: row.id,
      name: row.name,
      url: row.url,
      description: row.description,
      remoteEndpointUrl: row.remote_endpoint_url,
      // Deliberately no cached install_* fields — force a full recompute through the
      // now-fixed resolver, exactly like the health cron does for a fresh row.
    });

    // Slightly stricter than the health cron's persistence bar (which only rejects a
    // guess that is *both* low-confidence and heuristic): these rows are already known
    // to hold junk, so trading it for any unverified guess is not an improvement.
    if (isUnverifiedInstall(resolved)) {
      statements.push(
        `UPDATE servers SET install_kind = NULL, install_command = NULL, install_args = NULL, ` +
          `install_package = NULL, install_confidence = NULL WHERE id = ${sqlStr(row.id)};`,
      );
      cleared++;
      continue;
    }

    // Null means the resolve produced something the cache columns must not hold —
    // treat it exactly like an unverified guess and clear the row.
    const fields = toCachedInstallFields(resolved);
    if (!fields) {
      statements.push(
        `UPDATE servers SET install_kind = NULL, install_command = NULL, install_args = NULL, ` +
          `install_package = NULL, install_confidence = NULL WHERE id = ${sqlStr(row.id)};`,
      );
      cleared++;
      continue;
    }
    statements.push(
      `UPDATE servers SET install_kind = ${sqlStr(fields.installKind)}, ` +
        `install_command = ${sqlStr(fields.installCommand)}, ` +
        `install_args = ${sqlStr(fields.installArgs)}, ` +
        `install_package = ${sqlStr(fields.installPackage)}, ` +
        `install_confidence = ${sqlStr(fields.installConfidence)} ` +
        `WHERE id = ${sqlStr(row.id)};`,
    );
    persisted++;
  }

  if (statements.length === 0) {
    console.log('\nNothing to fix — no stale remote endpoints cached.');
    return;
  }

  const outPath = path.join(
    process.cwd(),
    'drizzle',
    'backfill-2026-09-10-stale-remote-endpoints.sql',
  );
  const header =
    `-- Backfill: clear/recompute install_* for ${affected.length} rows that cached a plain web\n` +
    `-- page as a remote MCP endpoint (heuristic fixed in lib/tools/parseInstallHint.ts).\n` +
    `-- Generated by scripts/backfill-stale-remote-endpoints.ts via the live resolveInstallConfig.\n` +
    `-- ${persisted} rows get a real value, ${cleared} rows get cleared (nothing verified was\n` +
    `-- available to replace them with — cleared rather than swapped for another guess).\n\n`;
  fs.writeFileSync(outPath, `${header + statements.join('\n')}\n`);
  console.log(
    `\nWrote ${statements.length} statements to ${path.relative(process.cwd(), outPath)}`,
  );
  console.log(
    `  ${persisted} corrected, ${cleared} cleared (nothing verified to replace them with)`,
  );

  if (!apply) {
    console.log('\nReview the file, then re-run with --apply to execute it.');
    return;
  }

  console.log('\nApplying to the live DB...');
  execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file=${outPath}`, {
    cwd: process.cwd(),
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
    stdio: 'inherit',
    maxBuffer: 1024 * 1024 * 20,
  });
  console.log('\nDone.');
}

main();
