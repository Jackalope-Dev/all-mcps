/**
 * One-off backlog cleanup: replaces bare technical `name` labels ("mcp",
 * "mcp-server", "reference-data", ...) with a real title. Uses the same pure
 * logic as app/api/cron/fix-names/route.ts (lib/listingEnrich.ts —
 * isGenericServerName / deriveServerName) so the two stay behaviorally
 * identical; this script is the fastest path to run it once against the live
 * catalog without shipping unrelated in-progress app changes via a deploy.
 *
 * This script does NOT talk to D1 itself — `wrangler d1 execute --file` uses
 * D1's bulk-import path, which doesn't return real SELECT results and is not
 * something to trust for a production UPDATE without independent
 * verification, and `--command` from inside Node's execFileSync fights
 * Windows .cmd quoting. So the split is:
 *   1. Dump rows with `wrangler d1 execute --command` (works fine from a
 *      normal shell) to a JSON file.
 *   2. This script reads that dump, fetches READMEs, derives new names, and
 *      writes a SQL file of UPDATE statements + a JSON report — no DB access.
 *   3. Apply the SQL file with `wrangler d1 execute --command` in small
 *      batches from a normal shell.
 *
 * Usage:
 *   wrangler d1 execute all-mcps --remote --json --command \
 *     "SELECT id, name, url, is_official FROM servers WHERE status='active'" > rows.json
 *   npx tsx scripts/fix-generic-server-names.mts rows.json out-dir
 *   # review out-dir/proposed-renames.json, then apply out-dir/updates.sql via wrangler
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import {
  deriveServerName,
  extractReadmeTitle,
  fetchGithubReadme,
  isGenericServerName,
  parseGithubUrl,
} from '../lib/listingEnrich';
import { getGithubToken } from '../lib/githubAuth';

type Row = { id: string; name: string; url: string; is_official: number };

const DELAY_MS = 150;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

async function main() {
  const [rowsPath, outDir] = process.argv.slice(2);
  if (!rowsPath || !outDir) {
    console.error('Usage: npx tsx scripts/fix-generic-server-names.mts <rows.json> <out-dir>');
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  const wrangled = JSON.parse(readFileSync(rowsPath, 'utf-8'));
  const rows: Row[] = wrangled[0]?.results ?? [];
  console.log(`Loaded ${rows.length} active listings from ${rowsPath}.`);

  const candidates = rows.filter((r) => !r.is_official && isGenericServerName(r.name));
  console.log(`${candidates.length} have a generic name and are not owner-claimed.\n`);

  const githubToken = getGithubToken();
  const results: { id: string; oldName: string; newName: string; source: string }[] = [];
  const skipped: { id: string; name: string; url: string }[] = [];
  let ghFailures = 0;

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const gh = parseGithubUrl(row.url);
    let readme: string | null = null;

    if (gh) {
      try {
        readme = await fetchGithubReadme(gh.owner, gh.repo, githubToken);
      } catch {
        ghFailures++;
      }
    }

    const newName = deriveServerName({ currentName: row.name, url: row.url, ghRepo: gh, readme });
    if (newName && newName !== row.name) {
      const readmeTitle = extractReadmeTitle(readme);
      const source = readmeTitle && readmeTitle.slice(0, 80) === newName ? 'readme-title' : gh ? 'slug' : 'hostname';
      results.push({ id: row.id, oldName: row.name, newName, source });
      console.log(`  [${i + 1}/${candidates.length}] ${row.id}: "${row.name}" -> "${newName}" (${source})`);
    } else {
      skipped.push({ id: row.id, name: row.name, url: row.url });
    }

    if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${candidates.length} scanned`);
    await sleep(DELAY_MS);
  }

  writeFileSync(`${outDir}/proposed-renames.json`, JSON.stringify(results, null, 2), 'utf-8');
  writeFileSync(`${outDir}/skipped.json`, JSON.stringify(skipped, null, 2), 'utf-8');

  const sql = results.map((r) => `UPDATE servers SET name = ${sqlString(r.newName)} WHERE id = ${sqlString(r.id)};`).join('\n');
  writeFileSync(`${outDir}/updates.sql`, sql, 'utf-8');

  const bySource = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] || 0) + 1;
    return acc;
  }, {});

  console.log(
    `\n${results.length}/${candidates.length} candidates got a better name (${ghFailures} GitHub fetch failures, ${skipped.length} left unchanged).`
  );
  console.log(`By source: ${JSON.stringify(bySource)}`);
  console.log(`\nWrote:\n  ${outDir}/proposed-renames.json\n  ${outDir}/skipped.json\n  ${outDir}/updates.sql`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
