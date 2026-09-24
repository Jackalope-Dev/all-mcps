/**
 * Build a badge-outreach list: popular, healthy listings whose repo README does
 * not yet carry an AllMCPs badge. Every badge a maintainer adds is a followed
 * link from github.com to their listing — the cheapest high-authority backlink
 * source we have.
 *
 * This script only PREPARES outreach. It writes a CSV with, per listing, a
 * prefilled "new issue" link (title + body filled in, nothing submitted). A
 * human opens each link, reads it, and decides whether to send — mass-filing
 * issues automatically would be spam and gets accounts flagged.
 *
 * Usage (read-only D1 query via wrangler; needs `wrangler login`):
 *   node scripts/badge-outreach.mjs                    # top 50 by stars, 100-5000 stars
 *   node scripts/badge-outreach.mjs --limit 100 --min-stars 200 --max-stars 20000
 *   node scripts/badge-outreach.mjs --out outreach.csv
 *
 * The default star window targets mid-sized, actively maintained projects:
 * mega-repos rarely accept badge issues, tiny ones pass little authority.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const LIMIT = Math.min(Number(value('--limit', 50)) || 50, 500);
const MIN_STARS = Number(value('--min-stars', 100)) || 0;
const MAX_STARS = Number(value('--max-stars', 5000)) || Number.MAX_SAFE_INTEGER;
const OUT = value('--out', 'badge-outreach.csv');
const SITE = 'https://allmcps.com';

const sql = `SELECT id, name, url, github_stars AS stars, ai_summary AS summary
  FROM servers
  WHERE status = 'active'
    AND health_status = 'healthy'
    AND readme_badge_ok = 0
    AND reciprocal_badge_ok = 0
    AND is_official = 0
    AND url LIKE 'https://github.com/%'
    AND coalesce(github_stars, 0) BETWEEN ${MIN_STARS} AND ${MAX_STARS}
  ORDER BY github_stars DESC
  LIMIT ${LIMIT * 2}`;

const raw = execFileSync(
  'npx',
  [
    'wrangler',
    'd1',
    'execute',
    'all-mcps',
    '--remote',
    '--json',
    '--command',
    sql.replace(/\s+/g, ' '),
  ],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
);
const rows = JSON.parse(raw)[0]?.results ?? [];

function repoPath(url) {
  const m = url.match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/);
  return m ? m[1].replace(/\.git$/, '') : null;
}

function issueBody(row) {
  const listing = `${SITE}/mcp/${row.id}`;
  const badge = `[![AllMCPs](${SITE}/api/badge/${row.id})](${listing})`;
  return [
    `Hi! ${row.name} is listed in the AllMCPs directory of MCP servers: ${listing}`,
    '',
    'The listing includes install snippets for Claude Desktop, Cursor, VS Code and other clients, live health checks, and a security advisory scan of the package.',
    '',
    'If it is useful, here is a badge you can add to the README. It shows the live health status and links users to the install instructions:',
    '',
    '```markdown',
    badge,
    '```',
    '',
    `Maintainers can also claim the listing to edit its description and get the Official badge: ${listing}/claim`,
    '',
    'No action needed if you would rather not — feel free to close this. Thanks for building it!',
  ].join('\n');
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const lines = [
  ['id', 'name', 'stars', 'repo', 'listing', 'prefilled_issue_url'].join(','),
];
// Monorepos (e.g. modelcontextprotocol/servers) back many listings — one issue per repo.
const seenRepos = new Set();
for (const row of rows) {
  const repo = repoPath(row.url);
  if (!repo || seenRepos.has(repo.toLowerCase())) continue;
  seenRepos.add(repo.toLowerCase());
  if (seenRepos.size > LIMIT) break;
  const issueUrl =
    `https://github.com/${repo}/issues/new?` +
    new URLSearchParams({
      title: `Listed on AllMCPs — optional README badge`,
      body: issueBody(row),
    }).toString();
  lines.push(
    [
      row.id,
      row.name,
      row.stars,
      `https://github.com/${repo}`,
      `${SITE}/mcp/${row.id}`,
      issueUrl,
    ]
      .map(csvCell)
      .join(','),
  );
}

fs.writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');
console.log(
  `Wrote ${lines.length - 1} candidates to ${OUT}. Open each prefilled_issue_url, review, and send only where it fits the repo's contribution norms (some repos disable issues or ask for discussions instead).`,
);
