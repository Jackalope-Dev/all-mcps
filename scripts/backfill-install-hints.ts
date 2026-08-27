/**
 * One-off backfill: re-derive cached install hints for listings whose install_* columns
 * were corrupted by two now-fixed bugs in lib/tools/parseInstallHint.ts —
 *
 *   1. "pip install X" was cached verbatim as the *run* command ({command:'pip',
 *      args:['install', X]}), which just installs the package and exits — never a
 *      running MCP stdio server. Some of these predate an even older bug and cached
 *      a bare pip flag ("-r", "-e") as the "package name".
 *   2. Captured package names routinely kept the sentence's trailing punctuation
 *      (e.g. "foo-mcp." from "...run npx -y foo-mcp."), which never resolves.
 *
 * Live reads already self-heal (resolveInstallConfig recomputes from `description`
 * whenever install_kind is unset), and the health cron would eventually rotate through
 * every row and persist a fix — but that's ~3.3k rows on a staleness rotation, so this
 * targets exactly the corrupted subset now instead of waiting.
 *
 * Recomputes each affected row through the actual (fixed) resolveInstallConfig — same
 * function the app uses at request time — rather than re-deriving the fix in SQL, so the
 * backfilled values are guaranteed to match what the site would resolve live. Mirrors the
 * health cron's own persistence policy (app/api/cron/health/route.ts): a low-confidence
 * heuristic guess is never written back, only cleared, so we don't trade "wrong" for
 * "confidently different but still a guess".
 *
 * Writes a reviewable SQL file to drizzle/ then applies it via wrangler.
 *
 * Usage: npx tsx scripts/backfill-install-hints.ts
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveInstallConfig,
  toCachedInstallFields,
} from '../lib/installConfig';

const DB_NAME = 'all-mcps';
// wrangler.jsonc has no `account_id`, and this Cloudflare login has more than one
// account, so a non-interactive `wrangler d1` call fails closed (7403) without this.
// Same value as scripts/ingest-sources.mjs.
const ACCOUNT_ID = '1a04a617cf42aaaba19b44365dd7c882';

type Row = {
  id: string;
  name: string;
  url: string;
  description: string;
  install_kind: string | null;
  install_command: string | null;
  install_args: string | null;
  install_package: string | null;
  install_confidence: string | null;
};

function sqlStr(v: string | null): string {
  if (v === null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

function hasTrailingPunctuation(s: string | null): boolean {
  if (!s) return false;
  return /[).,;:'"\]]$/.test(s);
}

function argsLastElemHasTrailingPunctuation(argsJson: string | null): boolean {
  if (!argsJson) return false;
  try {
    const arr = JSON.parse(argsJson);
    if (!Array.isArray(arr) || arr.length === 0) return false;
    return hasTrailingPunctuation(String(arr[arr.length - 1]));
  } catch {
    return false;
  }
}

function fetchAllServers(): Row[] {
  const cmd =
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command ` +
    `"SELECT id, name, url, description, install_kind, install_command, install_args, install_package, install_confidence FROM servers"`;
  const out = execSync(cmd, {
    cwd: process.cwd(),
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
    maxBuffer: 1024 * 1024 * 100,
  }).toString();
  const parsed = JSON.parse(out);
  return (parsed[0]?.results ?? []) as Row[];
}

function main() {
  console.log('Fetching all servers from the live DB...');
  const all = fetchAllServers();
  console.log(`  ${all.length} total rows`);

  const affected = all.filter(
    (r) =>
      r.install_command === 'pip' ||
      hasTrailingPunctuation(r.install_package) ||
      argsLastElemHasTrailingPunctuation(r.install_args),
  );
  console.log(
    `  ${affected.length} rows affected by the pip/trailing-punctuation bugs`,
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
      // Deliberately no cached fields — force a full recompute from `description`
      // through the now-fixed parser, exactly like the health cron does for a fresh row.
    });

    // Same bar the health cron uses: never persist a low-confidence heuristic guess.
    const shouldPersist = !(
      resolved.confidence === 'low' && resolved.source === 'heuristic'
    );

    if (shouldPersist) {
      const fields = toCachedInstallFields(resolved);
      statements.push(
        `UPDATE servers SET install_kind = ${sqlStr(fields.installKind)}, ` +
          `install_command = ${sqlStr(fields.installCommand)}, ` +
          `install_args = ${sqlStr(fields.installArgs)}, ` +
          `install_package = ${sqlStr(fields.installPackage)}, ` +
          `install_confidence = ${sqlStr(fields.installConfidence)} ` +
          `WHERE id = ${sqlStr(row.id)};`,
      );
      persisted++;
    } else {
      statements.push(
        `UPDATE servers SET install_kind = NULL, install_command = NULL, install_args = NULL, ` +
          `install_package = NULL, install_confidence = NULL WHERE id = ${sqlStr(row.id)};`,
      );
      cleared++;
    }
  }

  const outPath = path.join(
    process.cwd(),
    'drizzle',
    'backfill-2026-08-07-install-hints.sql',
  );
  const header =
    `-- Backfill: re-derive install_* for ${affected.length} rows corrupted by the pip-as-run-command\n` +
    `-- and trailing-punctuation bugs in lib/tools/parseInstallHint.ts (fixed 2026-08-07).\n` +
    `-- Generated by scripts/backfill-install-hints.ts — recomputed via the live resolveInstallConfig.\n` +
    `-- ${persisted} rows get a corrected value, ${cleared} rows get cleared (only a low-confidence\n` +
    `-- heuristic guess was available — cleared rather than persisted, per health-cron policy).\n\n`;
  fs.writeFileSync(outPath, `${header + statements.join('\n')}\n`);
  console.log(
    `\nWrote ${statements.length} statements to ${path.relative(process.cwd(), outPath)}`,
  );
  console.log(
    `  ${persisted} corrected, ${cleared} cleared (no better-than-low-confidence guess)`,
  );

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
