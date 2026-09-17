import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * One-off repair for servers whose `name` is a generic, indistinguishable
 * token ("mcp", "mcp-server", "server") instead of something that actually
 * identifies the project. See scripts/ingest-sources.mjs's
 * deriveOfficialRegistryName() for the ingest-time fix that stops new rows
 * from landing this way — this backfills the rows that already exist
 * (confirmed 2026-09-07: 124 active + 150 pending rows affected).
 *
 * Recovers `owner/repo` from the GitHub URL — the same fallback
 * lib/displayName.ts already uses for *display* — and writes it as the real
 * `name` column, so every consumer of `server.name` gets a meaningful value
 * instead of only render paths that remember to call parseServerName().
 *
 * By default it only writes drizzle/repair-generic-names-<date>.sql — review
 * it, then apply:
 *   npx wrangler d1 execute all-mcps --remote --file=drizzle/repair-generic-names-<date>.sql
 * Pass --apply to run that automatically.
 */

const AUTO_APPLY = process.argv.includes('--apply');
const DB_NAME = 'all-mcps';
// wrangler.jsonc has no `account_id`, and this Cloudflare login has more than one
// account, so a non-interactive `wrangler d1` call fails closed (7403) without this.
const ACCOUNT_ID = '1a04a617cf42aaaba19b44365dd7c882';
const WRANGLER_ENV = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };

// 'removed' rows are intentionally left alone — they're not visible anywhere
// on the site, so renaming them isn't worth the write.
const GENERIC_NAMES = new Set(['mcp', 'mcp-server', 'server']);

function queryCandidates() {
  const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --json --command "SELECT id, name, url, status FROM servers WHERE lower(name) IN ('mcp','mcp-server','server') AND status IN ('active','pending')"`;
  const out = execSync(cmd, {
    cwd: process.cwd(),
    env: WRANGLER_ENV,
    maxBuffer: 1024 * 1024 * 20,
  }).toString();
  return JSON.parse(out)[0]?.results ?? [];
}

function deriveNameFromUrl(url) {
  const m = url?.match(/(?:github|gitlab)\.com\/([^/]+)\/([^/#?]+)/i);
  if (m) return `${m[1]}/${m[2].replace(/\.git$/i, '')}`;
  // No forge owner/repo to key off — most of the remaining rows are
  // marketing/product sites for remote-only MCP servers (confirmed
  // 2026-09-07: 65 of 274, e.g. https://getlasso.co/mcp/). Fall back to the
  // registrable domain label instead of leaving them generic.
  try {
    const host = new URL(url).hostname.toLowerCase();
    const label = host.replace(/^(www|docs|api|app|get)\./, '').split('.')[0];
    if (!label) return null;
    return label
      .split(/[-_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  } catch {
    return null;
  }
}

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

async function main() {
  const rows = queryCandidates();
  console.log(
    `Found ${rows.length} active/pending rows named 'mcp' / 'mcp-server' / 'server'.`,
  );

  const updates = [];
  let skippedUnparseable = 0;
  for (const row of rows) {
    if (!GENERIC_NAMES.has(String(row.name).toLowerCase())) continue; // safety net, matches the WHERE clause
    const newName = deriveNameFromUrl(row.url);
    if (!newName) {
      skippedUnparseable++;
      continue;
    }
    updates.push({
      id: row.id,
      oldName: row.name,
      newName,
      status: row.status,
    });
  }

  if (skippedUnparseable) {
    console.log(
      `  Skipped ${skippedUnparseable} rows with an unparseable URL (not even a hostname to fall back to).`,
    );
  }
  if (updates.length === 0) {
    console.log('Nothing to fix.');
    return;
  }

  const sql = `${updates
    .map(
      (u) =>
        `UPDATE servers SET name = '${sqlEscape(u.newName)}' WHERE id = '${sqlEscape(u.id)}';`,
    )
    .join('\n')}\n`;

  const date = new Date().toISOString().slice(0, 10);
  const relPath = path.join('drizzle', `repair-generic-names-${date}.sql`);
  fs.writeFileSync(relPath, sql);
  console.log(`Wrote ${updates.length} UPDATEs to ${relPath}`);
  for (const u of updates.slice(0, 10)) {
    console.log(`  [${u.status}] "${u.oldName}" -> "${u.newName}"  (${u.id})`);
  }
  if (updates.length > 10) {
    console.log(`  ... and ${updates.length - 10} more`);
  }

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
