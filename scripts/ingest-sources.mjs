import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Pulls newly-added listings from other public MCP server lists and stages them
 * for review — see docs/superpowers/specs/2026-08-07-ingest-sources-design.md.
 *
 * Never writes to the DB itself. Fetches the source READMEs, dedupes against the
 * live catalog, and writes drizzle/ingest-<date>.sql with one INSERT per new
 * candidate (status='pending', same as a normal /api/submit). Review the file,
 * then apply it explicitly:
 *
 *   npx wrangler d1 execute all-mcps --remote --file=drizzle/ingest-<date>.sql
 */

const DB_NAME = 'all-mcps';
// wrangler.jsonc has no `account_id`, and this Cloudflare login has more than one
// account, so a non-interactive `wrangler d1` call fails closed (7403) without this.
const ACCOUNT_ID = '1a04a617cf42aaaba19b44365dd7c882';

const SOURCES = [
  {
    name: 'awesome-mcp-servers',
    readmeUrl: 'https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md',
    // The README also has non-server ## sections (Clients, Tutorials, Community,
    // Frameworks, Tips and Tricks, ...) using the same bullet-link format —
    // restrict parsing to the one ## section that's an actual server list.
    sectionHeadingMatch: (text) => /server implementations/i.test(text),
  },
  {
    name: 'modelcontextprotocol/servers',
    readmeUrl: 'https://raw.githubusercontent.com/modelcontextprotocol/servers/main/README.md',
    // Reference servers are listed as repo-relative paths (e.g. `src/everything`)
    // rather than full URLs — resolve those against the repo tree.
    baseTreeUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/',
    sectionHeadingMatch: (text) => /reference servers/i.test(text),
    // Deprecated/unmaintained reference servers — not worth ingesting.
    skipCategory: (category) => /archived/i.test(category),
  },
];

const DIRECTORY_CATEGORIES = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'lib', 'category-manifest.json'), 'utf8')
);
const DEFAULT_CATEGORY =
  DIRECTORY_CATEGORIES.find((c) => c.includes('Developer Tools')) ||
  DIRECTORY_CATEGORIES[0] ||
  '🛠️ Other Tools and Integrations';

// --- small ports of lib/urlSafety.ts + lib/description.ts -----------------
// (scripts/*.mjs run as plain Node ESM, not through the TS toolchain, so these
// can't be imported directly — kept intentionally verbatim so behavior matches
// what /api/submit and the cards already do.)

function isSafeSubmissionUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127 || a === 10 || a === 0) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    return true;
  }

  const v6 = host.replace(/^\[|\]$/g, '');
  if (v6 === '::1' || v6 === '::') return false;
  if (v6.startsWith('fe80:')) return false;
  if (/^f[cd][0-9a-f]{2}:/i.test(v6)) return false;

  return true;
}

function cleanListingDescription(description) {
  if (!description) return '';
  let text = description;
  for (let i = 0; i < 5; i++) {
    const before = text;
    text = text
      .replace(/^(?:\s*(?:!\[[^\]]*\]\([^)]*\)|\[\s*\]\([^)]*\))\s*)+/g, '')
      .replace(/^[\p{Extended_Pictographic}️‍\u{1F3FB}-\u{1F3FF}\s]+/u, '')
      .replace(/^[-–—:|·•]+\s+/, '');
    if (text === before) break;
  }
  text = text.trim();
  return text.length > 0 ? text : description.trim();
}

// --- category matching (trimmed-down lib/categories.ts normalizeCategory) --

function stripEmojiLabel(category) {
  return category.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

function normalizeCategoryLite(input) {
  if (!input || !input.trim()) return DEFAULT_CATEGORY;
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const exact = DIRECTORY_CATEGORIES.find((c) => c === raw);
  if (exact) return exact;

  const caseMatch = DIRECTORY_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (caseMatch) return caseMatch;

  const label = stripEmojiLabel(raw).toLowerCase();
  const labelMatch = DIRECTORY_CATEGORIES.find((c) => stripEmojiLabel(c).toLowerCase() === label);
  if (labelMatch) return labelMatch;

  const partial = DIRECTORY_CATEGORIES.find((c) => {
    const l = stripEmojiLabel(c).toLowerCase();
    return l === label || l.includes(label) || label.includes(l);
  });
  if (partial) return partial;

  return DEFAULT_CATEGORY;
}

// --- dedup key + id slug ----------------------------------------------------

function normalizeUrlKey(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const p = u.pathname.replace(/\.git$/i, '').replace(/\/+$/, '');
    return `${u.hostname.toLowerCase()}${p.toLowerCase()}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `mcp-${Date.now()}`
  );
}

// --- fetch + parse -----------------------------------------------------------

async function fetchReadme(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'AllMCPs-Ingest' } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

const HEADING_RE = /^(#{2,4})\s+(.*)$/;
const ITEM_RE = /^[-*]\s*(?:\*\*)?\[([^\]]+)\]\(([^)]+)\)(?:\*\*)?\s*(?:[-–—:])?\s*(.*)$/;

function parseServerList(markdown, source) {
  const lines = markdown.split('\n');
  const entries = [];
  let currentCategory = 'Other';
  // Only the ## section matching sectionHeadingMatch actually lists servers —
  // everything else (tutorials, community links, frameworks, ...) is skipped.
  let inSection = !source.sectionHeadingMatch;
  let skipCurrentCategory = false;

  for (const line of lines) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const cleaned = heading[2]
        .replace(/<[^>]*>?/gm, '')
        .replace(/[*_`]/g, '')
        .trim();

      if (level === 2) {
        inSection = source.sectionHeadingMatch ? source.sectionHeadingMatch(cleaned) : true;
        continue;
      }

      if (inSection && cleaned) {
        currentCategory = cleaned;
        skipCurrentCategory = source.skipCategory ? source.skipCategory(cleaned) : false;
      }
      continue;
    }

    if (!inSection || skipCurrentCategory) continue;

    const match = line.match(ITEM_RE);
    if (!match) continue;

    const name = match[1].trim();
    let url = match[2].trim();
    let description = (match[3] || '').trim();

    if (!url || url.startsWith('#')) continue; // TOC anchor
    if (name.toLowerCase().includes('awesome')) continue; // self-referential TOC entry

    if (!/^https?:\/\//i.test(url)) {
      if (!source.baseTreeUrl) continue; // relative path with nowhere to resolve it against
      url = source.baseTreeUrl + url.replace(/^\.?\//, '');
    }

    description = description
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]*>?/gm, '')
      .replace(/[*_~`]/g, '')
      .trim();

    entries.push({ name, url, description, category: currentCategory });
  }

  return entries;
}

// --- live DB lookup ------------------------------------------------------

function queryExisting() {
  const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --json --command "SELECT id, url FROM servers"`;
  let out;
  try {
    out = execSync(cmd, {
      cwd: process.cwd(),
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
      maxBuffer: 1024 * 1024 * 20,
    }).toString();
  } catch (err) {
    console.error(
      'Failed to query the live database via wrangler. Run `npx wrangler login` for the ' +
        'AllMCPs Cloudflare account and try again.'
    );
    throw err;
  }
  const parsed = JSON.parse(out);
  return parsed[0]?.results ?? [];
}

// --- main ------------------------------------------------------------------

async function main() {
  console.log('Fetching source lists...');
  const allEntries = [];
  for (const source of SOURCES) {
    const md = await fetchReadme(source.readmeUrl);
    const entries = parseServerList(md, source);
    console.log(`  ${source.name}: ${entries.length} entries parsed`);
    allEntries.push(...entries);
  }

  const byUrlKey = new Map();
  for (const e of allEntries) {
    if (!isSafeSubmissionUrl(e.url)) continue;
    const key = normalizeUrlKey(e.url);
    if (!byUrlKey.has(key)) byUrlKey.set(key, { ...e, urlKey: key });
  }
  console.log(`Deduped to ${byUrlKey.size} unique candidates across sources.`);

  console.log('Querying live DB for existing urls/ids...');
  const existing = queryExisting();
  const existingUrlKeys = new Set(existing.map((r) => normalizeUrlKey(r.url)));
  const usedIds = new Set(existing.map((r) => r.id));
  console.log(`  ${existing.length} servers already on file.`);

  const newCandidates = [...byUrlKey.values()].filter((c) => !existingUrlKeys.has(c.urlKey));
  console.log(`${newCandidates.length} candidates are not yet in the catalog.`);

  if (newCandidates.length === 0) {
    console.log('Nothing new to add.');
    return;
  }

  const rows = [];
  for (const c of newCandidates) {
    const base = slugify(c.name);
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n++}`;
    }
    usedIds.add(id);

    rows.push({
      id,
      name: c.name,
      url: c.url,
      description: cleanListingDescription(c.description) || 'No description provided.',
      category: normalizeCategoryLite(c.category),
      isOfficial: c.url.toLowerCase().includes('github.com/modelcontextprotocol/servers'),
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  const sqlPath = path.join(process.cwd(), 'drizzle', `ingest-${date}.sql`);
  const esc = (s) => String(s).replace(/'/g, "''");

  let sql = '';
  for (const r of rows) {
    // created_at is stored in Unix *seconds* (matches scripts/seed-sql.mjs and the
    // Drizzle submit route) — do not multiply by 1000.
    sql +=
      `INSERT INTO servers (id, name, url, description, category, is_official, status, created_at) ` +
      `VALUES ('${esc(r.id)}', '${esc(r.name)}', '${esc(r.url)}', '${esc(r.description)}', ` +
      `'${esc(r.category)}', ${r.isOfficial ? 1 : 0}, 'pending', strftime('%s', 'now')) ` +
      `ON CONFLICT(id) DO NOTHING;\n`;
  }

  fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
  fs.writeFileSync(sqlPath, sql);

  const relPath = path.relative(process.cwd(), sqlPath);
  console.log(`\nWrote ${rows.length} new listings to ${relPath}`);
  console.log('First up to 15 new listings:');
  for (const r of rows.slice(0, 15)) {
    console.log(`  - ${r.name}  (${r.category})  ${r.url}`);
  }
  console.log(`\nReview the file, then apply it with:\n  npx wrangler d1 execute ${DB_NAME} --remote --file=${relPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
