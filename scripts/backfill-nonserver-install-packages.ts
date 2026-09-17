/**
 * One-off backfill: clear cached install hints whose package is not this listing's server.
 *
 * Rows written before lib/tools/parseInstallHint.ts learned to tokenise a runner
 * invocation cached whatever token followed the first `npx`/`uvx`/`bunx` anywhere in the
 * README. That is routinely:
 *
 *  - a debugging CLI — `npx @modelcontextprotocol/inspector`, the snippet every server
 *    author is told to test against (246 listings, including hosted servers with no npm
 *    package at all; this is what owners have been writing in about);
 *  - an installer CLI that takes the real package as an argument — `@smithery/cli`,
 *    `add-mcp`, `mcp-get` (~470 listings);
 *  - deploy/test tooling from a Development section — `wrangler`, `vercel`, `pytest`;
 *  - a bare flag — `uvx --from <pkg> <cmd>` cached "--from" (~370 listings);
 *  - prose or a placeholder — "to", "or", "your-package-name".
 *
 * All of it cached at high confidence, which outranks every other source in
 * resolveInstallConfig. Live reads already self-heal (fromCached re-checks the package
 * against isPlausibleInstallPackage and falls through), so this is about the stored value,
 * which nothing else clears and which other consumers read directly — the npm/PyPI
 * liveness probe behind isListingTrulyDead and the OSV vuln scanner both resolve
 * install_package as if it were this server's package.
 *
 * Each affected row is recomputed through the actual (fixed) resolveInstallConfig — the
 * same function the app uses at request time. A row is only rewritten when that recompute
 * yields something verified; otherwise it is cleared, never swapped for another guess.
 * Rows the AI pipeline has already validated (install_extracted_at set) are only ever
 * cleared, never recomputed: re-deriving a heuristic guess for a row an LLM read in full
 * would undo the better answer.
 *
 * Writes a reviewable SQL file plus a rollback file to drizzle/. Pass --apply to also run
 * it against the live DB via wrangler; without it the script only writes the files.
 *
 * Usage: npx tsx scripts/backfill-nonserver-install-packages.ts [--apply]
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  isUnverifiedInstall,
  resolveInstallConfig,
  toCachedInstallFields,
} from '../lib/installConfig';
import { isPlausibleInstallPackage } from '../lib/tools/parseInstallHint';

const DB_NAME = 'all-mcps';
const STAMP = '2026-09-17';
// Deliberately no CLOUDFLARE_ACCOUNT_ID override here (the older backfill scripts set
// one): with the current OAuth login, forcing the account tag makes the D1 API reject the
// call with 7403, while letting wrangler resolve it from the login works.

type Row = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  install_kind: string | null;
  install_command: string | null;
  install_args: string | null;
  install_package: string | null;
  install_confidence: string | null;
  install_extracted_at: number | null;
  remote_endpoint_url: string | null;
};

function sqlStr(v: string | null): string {
  if (v === null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

function fetchStdioServers(): Row[] {
  // Description is truncated: it is only used to re-parse an install hint (which always
  // appears early), and the untruncated column across ~11k rows blows past the JSON
  // response size wrangler will hand back.
  const cmd =
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command ` +
    `"SELECT id, name, url, substr(description, 1, 4000) AS description, install_kind, ` +
    `install_command, install_args, install_package, install_confidence, ` +
    `install_extracted_at, remote_endpoint_url FROM servers ` +
    `WHERE install_kind = 'stdio' AND install_package IS NOT NULL"`;
  const out = execSync(cmd, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 200,
  }).toString();
  const parsed = JSON.parse(out);
  return (parsed[0]?.results ?? []) as Row[];
}

const CLEAR_COLUMNS =
  'install_kind = NULL, install_command = NULL, install_args = NULL, ' +
  'install_package = NULL, install_confidence = NULL';

function main() {
  const apply = process.argv.includes('--apply');

  console.log("Fetching servers cached as install_kind='stdio'...");
  const all = fetchStdioServers();
  console.log(`  ${all.length} rows cached as stdio`);

  const affected = all.filter(
    (r) => !isPlausibleInstallPackage(r.install_package || ''),
  );
  console.log(
    `  ${affected.length} of them cache a package that is not a server package`,
  );

  const statements: string[] = [];
  const rollback: string[] = [];
  let persisted = 0;
  let cleared = 0;

  for (const row of affected) {
    rollback.push(
      `UPDATE servers SET install_kind = ${sqlStr(row.install_kind)}, ` +
        `install_command = ${sqlStr(row.install_command)}, ` +
        `install_args = ${sqlStr(row.install_args)}, ` +
        `install_package = ${sqlStr(row.install_package)}, ` +
        `install_confidence = ${sqlStr(row.install_confidence)} ` +
        `WHERE id = ${sqlStr(row.id)};`,
    );

    const clear = `UPDATE servers SET ${CLEAR_COLUMNS} WHERE id = ${sqlStr(row.id)};`;

    // Already read in full by the AI pipeline — clear the junk, don't replace it with a
    // regex guess the LLM pass would only have to undo again.
    if (row.install_extracted_at) {
      statements.push(clear);
      cleared++;
      continue;
    }

    const resolved = resolveInstallConfig({
      id: row.id,
      name: row.name,
      url: row.url,
      description: row.description,
      remoteEndpointUrl: row.remote_endpoint_url,
      // Deliberately no cached install_* fields — force a full recompute through the
      // now-fixed resolver, exactly like the health cron does for a fresh row.
    });

    // These rows are already known to hold junk, so trading it for any unverified guess
    // is not an improvement.
    const fields = isUnverifiedInstall(resolved)
      ? null
      : toCachedInstallFields(resolved);

    if (!fields) {
      statements.push(clear);
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
    console.log('\nNothing to fix — no non-server packages cached.');
    return;
  }

  const byPackage = new Map<string, number>();
  for (const row of affected) {
    const key = row.install_package || '(null)';
    byPackage.set(key, (byPackage.get(key) ?? 0) + 1);
  }
  const top = [...byPackage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('\nMost common cached non-server packages:');
  for (const [pkg, n] of top) console.log(`  ${String(n).padStart(5)}  ${pkg}`);

  const outPath = path.join(
    process.cwd(),
    'drizzle',
    `backfill-${STAMP}-nonserver-install-packages.sql`,
  );
  const rollbackPath = path.join(
    process.cwd(),
    'drizzle',
    `rollback-${STAMP}-nonserver-install-packages.sql`,
  );

  const header =
    `-- Backfill: clear/recompute install_* for ${affected.length} rows whose cached package is\n` +
    `-- a debugging CLI, an installer CLI, deploy tooling, a bare flag or a placeholder —\n` +
    `-- never the listing's own server (parser fixed in lib/tools/parseInstallHint.ts).\n` +
    `-- Generated by scripts/backfill-nonserver-install-packages.ts via the live resolveInstallConfig.\n` +
    `-- ${persisted} rows get a real value, ${cleared} rows get cleared (nothing verified was\n` +
    `-- available to replace them with — cleared rather than swapped for another guess).\n\n`;
  fs.writeFileSync(outPath, `${header + statements.join('\n')}\n`);

  const rollbackHeader =
    `-- ROLLBACK for backfill-${STAMP}-nonserver-install-packages.sql.\n` +
    `-- Restores the previous install_* values for all ${affected.length} rows it touched.\n` +
    `-- Only needed if the cleanup turns out to have been wrong — the cleared values were junk.\n\n`;
  fs.writeFileSync(rollbackPath, `${rollbackHeader + rollback.join('\n')}\n`);

  console.log(
    `\nWrote ${statements.length} statements to ${path.relative(process.cwd(), outPath)}`,
  );
  console.log(`  rollback: ${path.relative(process.cwd(), rollbackPath)}`);
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
    stdio: 'inherit',
    maxBuffer: 1024 * 1024 * 20,
  });
  console.log('\nDone.');
}

main();
