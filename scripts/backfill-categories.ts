/**
 * One-off backfill: re-derive listing categories with Jev (TypeSafe System One).
 *
 * Categories were originally assigned by `inferCategoryFromSignals` in
 * scripts/ingest-sources.mjs — 23 first-match-wins regexes that return nothing
 * when no rule matches, falling through to DEFAULT_CATEGORY ("💻 Developer
 * Tools"). That bucket now holds ~38% of the catalog and means two different
 * things at once: "this is a developer tool" and "we could not tell". Browse,
 * category pages, and category-scoped search all degrade as a result, and
 * scripts/reclassify-developer-tools.mjs exists because more regexes were the
 * only tool available at the time.
 *
 * This asks the question directly, against the real 56-category list, and only
 * takes answers above CATEGORY_CONFIDENCE_FLOOR. Anything below that keeps its
 * existing category — a low-confidence reassignment is worse than an honest
 * default, because at least the default is predictable.
 *
 * Reads the catalog through wrangler, writes a reviewable SQL file plus a
 * rollback file to drizzle/, and only touches the live DB with --apply.
 *
 * By default it only reconsiders listings sitting in the default bucket, which
 * is where the damage is. Pass --all to re-derive every active listing.
 *
 * Usage:
 *   npx tsx scripts/backfill-categories.ts [--all] [--limit=N] [--apply]
 *
 * Requires TYPESAFE_API_KEY in the environment. Without it every call falls
 * back and the script correctly reports zero changes.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  CATEGORY_CONFIDENCE_FLOOR,
  classifyCategory,
} from '../lib/categoryClassifier';
import { isJevConfigured } from '../lib/typesafe';

const DB_NAME = 'all-mcps';
const STAMP = new Date().toISOString().slice(0, 10);
// Deliberately no CLOUDFLARE_ACCOUNT_ID override: with the current OAuth login,
// forcing the account tag makes the D1 API reject the call with 7403.

/** Concurrency against the API. Observed p50 is ~150ms; this keeps a full sweep short
 *  without becoming the reason we get rate limited. */
const CONCURRENCY = 8;

type Row = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  category: string;
};

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function fetchRows(onlyDefaultBucket: boolean, limit: number | null): Row[] {
  // Description is truncated: only the opening lines carry the signal that
  // decides a category, and the full column across ~11k rows blows past the
  // JSON response size wrangler will hand back.
  const where = onlyDefaultBucket
    ? `WHERE status = 'active' AND category LIKE '%Developer Tools%'`
    : `WHERE status = 'active'`;
  const cmd =
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command ` +
    `"SELECT id, name, url, substr(description, 1, 2000) AS description, category ` +
    `FROM servers ${where}${limit ? ` LIMIT ${limit}` : ''}"`;
  const out = execSync(cmd, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 200,
  }).toString();
  const parsed = JSON.parse(out);
  return (parsed[0]?.results ?? []) as Row[];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index], index);
      }
    })(),
  );
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const all = args.includes('--all');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : null;

  if (!(await isJevConfigured())) {
    console.error(
      'TYPESAFE_API_KEY is not set — every classification would fall back and nothing would change.',
    );
    process.exitCode = 1;
    return;
  }

  const rows = fetchRows(!all, limit);
  console.log(
    `Fetched ${rows.length} listings (${all ? 'all active' : 'default bucket only'})`,
  );
  if (rows.length === 0) return;

  let reviewed = 0;
  const changes: { row: Row; to: string; confidence: number }[] = [];

  await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    const result = await classifyCategory(
      { name: row.name, description: row.description, url: row.url },
      row.category,
    );
    reviewed++;
    if (reviewed % 200 === 0) {
      console.log(`  ...${reviewed}/${rows.length}`);
    }
    if (result.fromJev && result.category !== row.category) {
      changes.push({ row, to: result.category, confidence: result.confidence });
    }
  });

  console.log(
    `\n${changes.length} of ${rows.length} would move category ` +
      `(confidence floor ${CATEGORY_CONFIDENCE_FLOOR})`,
  );

  const byTarget = new Map<string, number>();
  for (const c of changes) byTarget.set(c.to, (byTarget.get(c.to) ?? 0) + 1);
  for (const [cat, n] of [...byTarget.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${cat}`);
  }

  if (changes.length === 0) return;

  const header =
    `-- Category backfill via Jev (TypeSafe System One), ${STAMP}.\n` +
    `-- Only answers at or above confidence ${CATEGORY_CONFIDENCE_FLOOR} are included.\n` +
    `-- Generated by scripts/backfill-categories.ts\n\n`;

  const forward =
    header +
    changes
      .map(
        (c) =>
          `UPDATE servers SET category = ${sqlStr(c.to)} WHERE id = ${sqlStr(c.row.id)}; -- was ${c.row.category} (conf ${c.confidence.toFixed(2)})`,
      )
      .join('\n');

  const rollback =
    `-- Rollback for the ${STAMP} category backfill.\n\n` +
    changes
      .map(
        (c) =>
          `UPDATE servers SET category = ${sqlStr(c.row.category)} WHERE id = ${sqlStr(c.row.id)};`,
      )
      .join('\n');

  const outPath = path.resolve(`drizzle/backfill-${STAMP}-categories.sql`);
  const rollbackPath = path.resolve(`drizzle/rollback-${STAMP}-categories.sql`);
  fs.writeFileSync(outPath, `${forward}\n`);
  fs.writeFileSync(rollbackPath, `${rollback}\n`);
  console.log(`\nWrote ${outPath}`);
  console.log(`Wrote ${rollbackPath}`);

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

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
