import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Pulls newly-added listings from other public MCP server lists and stages them
 * for review — see docs/superpowers/specs/2026-08-07-ingest-sources-design.md.
 *
 * Fetches the source READMEs plus the official MCP Registry API, dedupes
 * against the live catalog, and writes drizzle/ingest-<date>.sql with one
 * INSERT per new candidate.
 *
 * By default it only writes the file — review it, then apply explicitly:
 *
 *   npx wrangler d1 execute all-mcps --remote --file=drizzle/ingest-<date>.sql
 *
 * Pass --apply (used by the weekly `.github/workflows/registry-sync.yml` cron)
 * to run that wrangler command automatically right after writing the file —
 * requires CLOUDFLARE_API_TOKEN in the environment for non-interactive auth.
 *
 * Official-registry candidates land with status='active' (no admin review —
 * they're already vetted by the registry's own moderation policy). The two
 * README sources still land 'pending', same as a normal /api/submit.
 */

const AUTO_APPLY = process.argv.includes('--apply');

const DB_NAME = 'all-mcps';
// wrangler.jsonc has no `account_id`, and this Cloudflare login has more than one
// account, so a non-interactive `wrangler d1` call fails closed (7403) without this.
const ACCOUNT_ID = '1a04a617cf42aaaba19b44365dd7c882';

// The official MCP Registry (https://registry.modelcontextprotocol.io) — see
// https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/registry-aggregators.mdx.
// Stateless full re-fetch each run (mirrors the README sources below): dedup
// against live DB state means re-running only ever picks up what's new. If the
// registry grows large enough for that to get slow, switch to the `updated_since`
// cursor param instead of paging everything every time.
const OFFICIAL_REGISTRY_BASE = 'https://registry.modelcontextprotocol.io';
const OFFICIAL_REGISTRY_MAX_PAGES = 300; // 300 * 100 = 30,000 servers (registry already exceeds 5,000 as of 2026-08)

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

const CATEGORY_RULES = [
  {
    category: '🗄️ Databases',
    regex: /\b(postgres|postgresql|mysql|sqlite|mongodb|redis|supabase|neon|clickhouse|cassandra|dynamodb|planetscale|cockroachdb|memcached|duckdb|snowflake|bigquery|couchdb|prisma|drizzle|sql|database|datastore|timescaledb|vectordb)\b/i,
  },
  {
    category: '💬 Communication',
    regex: /\b(slack|discord|telegram|whatsapp|email|gmail|sendgrid|resend|mailchimp|matrix|teams|twilio|zendesk|intercom|messaging|messenger|outlook)\b/i,
  },
  {
    category: '📂 Browser Automation',
    regex: /\b(playwright|puppeteer|selenium|browserbase|stagehand|headful|headless-browser|browser-automation|chromedp|web-browser|browser-use)\b/i,
  },
  {
    category: '🔎 Search & Data Extraction',
    regex: /\b(serper|tavily|brave-search|google-search|bing-search|duckduckgo|web-scraper|scraping|crawling|web-crawler|firecrawl|jina-ai|diffbot|web-extraction|web-search)\b/i,
  },
  {
    category: '🔄 Version Control',
    regex: /\b(github-api|github-issues|github-pulls|gitlab|bitbucket|gitea|git-repo|git-commit|version-control|subversion|mercurial)\b/i,
  },
  {
    category: '☁️ Cloud Platforms',
    regex: /\b(aws|amazon-web-services|gcp|google-cloud|azure|cloudflare|terraform|kubernetes|k8s|docker|vercel|netlify|digitalocean|heroku|cloud-infrastructure|aws-lambda|s3-bucket)\b/i,
  },
  {
    category: '📊 Monitoring',
    regex: /\b(sentry|datadog|prometheus|grafana|opentelemetry|logrocket|newrelic|pagerduty|uptime|logging|observability|metrics|alerting|statuspage)\b/i,
  },
  {
    category: '🏢 Workplace & Productivity',
    regex: /\b(jira|linear|trello|asana|notion|clickup|confluence|google-calendar|google-docs|todoist|airtable|workplace|google-sheets|excel)\b/i,
  },
  {
    category: '💰 Finance & Fintech',
    regex: /\b(stripe|shopify|plaid|crypto|solana|ethereum|bitcoin|base-chain|x402|stock-market|finance|financial|accounting|hledger|forex|sec-edgar|wallet|token|defi|fintech|sepa|exchange-rate)\b/i,
  },
  {
    category: '🧠 Knowledge & Memory',
    regex: /\b(pinecone|weaviate|qdrant|chroma|vector-db|vector-database|rag|memory|knowledge-base|obsidian|roam|logseq|mem0|zotero|notes|note-taking|embeddings)\b/i,
  },
  {
    category: '🔒 Security',
    regex: /\b(security-scan|vulnerability|vulnerabilities|secrets|vault|snyk|sonar|auth0|okta|pentest|penetration|cve|threat-analysis|cybersecurity|auth-type)\b/i,
  },
  {
    category: '🧬 Biology & Bioinformatics',
    regex: /\b(ncbi|blast|pubchem|dna|protein|bioinformatics|genomics|chembl|pdb|uniprot|medical|healthcare|biology)\b/i,
  },
  {
    category: '🎮 Gaming',
    regex: /\b(unity|unreal|minecraft|steam|game-engine|chess|poker|gaming|games)\b/i,
  },
  {
    category: '🎙️ Speech-to-Text',
    regex: /\b(whisper|speech-to-text|stt|transcription|transcribe|audio-transcription)\b/i,
  },
  {
    category: '🎧 Text-to-Speech',
    regex: /\b(elevenlabs|text-to-speech|tts|voice-synthesis)\b/i,
  },
  {
    category: '🎥 Multimedia Process',
    regex: /\b(ffmpeg|video-processing|video-editing|image-processing|opencv|sharp|yt-dlp|youtube-dl|audio-processing|media-processing)\b/i,
  },
  {
    category: '🏠 Home Automation',
    regex: /\b(home-assistant|homebridge|mqtt|zigbee|smart-home)\b/i,
  },
  {
    category: '🚀 Aerospace & Astrodynamics',
    regex: /\b(astronomy|nasa|satellite|orbit|celestial|spacetrack)\b/i,
  },
  {
    category: '🛒 E-Commerce',
    regex: /\b(woocommerce|magento|ecommerce|e-commerce|shopping-cart)\b/i,
  },
  {
    category: '⚖️ Legal',
    regex: /\b(legal|law|contracts|court|court-listener)\b/i,
  },
  {
    category: '🌐 Social Media',
    regex: /\b(twitter|x-api|bluesky|mastodon|reddit|linkedin|facebook|instagram|tiktok|social-media)\b/i,
  },
  {
    category: '👨‍💻 Code Execution',
    regex: /\b(code-execution|python-interpreter|repl|sandbox|e2b|run-code)\b/i,
  },
  {
    category: '📂 File Systems',
    regex: /\b(filesystem|file-system|local-files|directory-tree|file-search|google-drive|dropbox|onedrive)\b/i,
  },
];

function inferCategoryFromSignals(name, description, rawUrl) {
  const cleanUrl = (rawUrl || '').replace(/^https?:\/\/(www\.)?github\.com\//i, '');
  const text = `${name || ''} ${description || ''} ${cleanUrl}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.regex.test(text)) {
      return rule.category;
    }
  }
  return undefined; // fallback to DEFAULT_CATEGORY
}

function normalizeCategoryLite(input, fallbackName, fallbackDesc, fallbackUrl) {
  if (!input || !input.trim()) {
    return inferCategoryFromSignals(fallbackName, fallbackDesc, fallbackUrl) || DEFAULT_CATEGORY;
  }
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

  return inferCategoryFromSignals(fallbackName, fallbackDesc, fallbackUrl) || DEFAULT_CATEGORY;
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

    entries.push({ name, url, description, category: currentCategory, source: source.name });
  }

  return entries;
}

// --- official MCP Registry (JSON API, not markdown) -----------------------

async function fetchOfficialRegistryEntries() {
  const entries = [];
  let cursor;
  let page = 0;
  let skippedNoUrl = 0;
  let skippedInactive = 0;

  do {
    const url = new URL(`${OFFICIAL_REGISTRY_BASE}/v0.1/servers`);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url, { headers: { 'User-Agent': 'AllMCPs-Ingest' } });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const body = await res.json();

    for (const entry of body.servers ?? []) {
      const server = entry.server;
      if (!server) continue;

      // Only ingest servers the registry itself currently considers active —
      // 'deprecated'/'deleted' status typically means spam, malware, or a
      // moderation-policy violation (per the aggregators doc).
      const registryStatus = entry._meta?.['io.modelcontextprotocol.registry/official']?.status;
      if (registryStatus && registryStatus !== 'active') {
        skippedInactive++;
        continue;
      }

      // Our schema requires a primary `url`; prefer the source repo, fall
      // back to the marketing site for remote-only servers with no repo link.
      const primaryUrl = server.repository?.url || server.websiteUrl;
      if (!primaryUrl) {
        skippedNoUrl++;
        continue;
      }

      const name = server.title || server.name?.split('/').pop() || server.name;
      const desc = server.description || '';
      entries.push({
        name,
        url: primaryUrl,
        description: desc,
        category: inferCategoryFromSignals(name, desc, primaryUrl), // Infers specific category or falls back to DEFAULT_CATEGORY
        websiteUrl: server.websiteUrl && server.websiteUrl !== primaryUrl ? server.websiteUrl : undefined,
        source: 'official-registry',
      });
    }

    cursor = body.metadata?.nextCursor;
    page++;
  } while (cursor && page < OFFICIAL_REGISTRY_MAX_PAGES);

  if (page >= OFFICIAL_REGISTRY_MAX_PAGES && cursor) {
    console.warn(`  official-registry: hit the ${OFFICIAL_REGISTRY_MAX_PAGES}-page safety cap with more pages remaining.`);
  }
  if (skippedNoUrl) console.log(`  official-registry: skipped ${skippedNoUrl} entries with no usable URL.`);
  if (skippedInactive) console.log(`  official-registry: skipped ${skippedInactive} non-active entries.`);

  return entries;
}

// --- liveness pre-check for official-registry candidates -------------------
// The registry's own moderation doesn't verify submitted repo URLs are still
// live (confirmed in practice: the first live import included several
// already-404 entries — see agentbuilders/fulcrum in the 2026-08-10 batch).
// Since official-registry candidates otherwise skip admin review and publish
// straight to 'active', give each new one a single lightweight reachability
// check first — a failure demotes it to 'pending' (the normal review queue)
// instead of publishing a dead link live. Bounded concurrency so a batch of
// new candidates doesn't fire hundreds of requests at once.
const LIVENESS_TIMEOUT_MS = 6000;
const LIVENESS_CONCURRENCY = 10;

async function checkLive(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'AllMCPs-Ingest' },
      signal: AbortSignal.timeout(LIVENESS_TIMEOUT_MS),
    });
    // Some hosts reject HEAD (405/501) — retry with GET before concluding it's dead.
    if (res.status === 405 || res.status === 501) {
      const getRes = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'AllMCPs-Ingest' },
        signal: AbortSignal.timeout(LIVENESS_TIMEOUT_MS),
      });
      return getRes.ok;
    }
    return res.ok;
  } catch {
    return false;
  }
}

async function checkLivenessOfRegistryCandidates(candidates) {
  const toCheck = candidates.filter((c) => c.source === 'official-registry');
  if (toCheck.length === 0) return;
  console.log(`Live-checking ${toCheck.length} new official-registry candidates...`);

  let deadCount = 0;
  for (let i = 0; i < toCheck.length; i += LIVENESS_CONCURRENCY) {
    const chunk = toCheck.slice(i, i + LIVENESS_CONCURRENCY);
    const results = await Promise.all(chunk.map((c) => checkLive(c.url)));
    chunk.forEach((c, idx) => {
      if (!results[idx]) {
        c.liveCheckFailed = true;
        deadCount++;
      }
    });
  }
  if (deadCount > 0) {
    console.log(`  ${deadCount} of ${toCheck.length} appear dead on arrival — landing as 'pending' for review instead of 'active'.`);
  }
}

// --- live DB lookup / apply ------------------------------------------------

// CLOUDFLARE_API_TOKEN, when present (e.g. in the registry-sync CI workflow),
// makes wrangler authenticate non-interactively instead of needing a prior
// `npx wrangler login`. Passed through untouched via `...process.env`.
const WRANGLER_ENV = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };

function queryExisting() {
  const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --json --command "SELECT id, url FROM servers"`;
  let out;
  try {
    out = execSync(cmd, {
      cwd: process.cwd(),
      env: WRANGLER_ENV,
      maxBuffer: 1024 * 1024 * 20,
    }).toString();
  } catch (err) {
    console.error(
      'Failed to query the live database via wrangler. Run `npx wrangler login` for the ' +
        'AllMCPs Cloudflare account (or set CLOUDFLARE_API_TOKEN) and try again.'
    );
    throw err;
  }
  const parsed = JSON.parse(out);
  return parsed[0]?.results ?? [];
}

function applySql(relPath) {
  const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --file=${relPath}`;
  console.log(`\nApplying via: ${cmd}`);
  execSync(cmd, { cwd: process.cwd(), env: WRANGLER_ENV, stdio: 'inherit' });
}

// --- main ------------------------------------------------------------------

async function main() {
  console.log('Fetching source lists...');

  // Official-registry entries go first: when the same repo also shows up in
  // one of the README sources below, the dedup loop keeps whichever entry it
  // sees first, and registry data (accurate description, auto-approved
  // status) should win over a possibly-stale awesome-list scrape.
  const registryEntries = await fetchOfficialRegistryEntries();
  console.log(`  official-registry: ${registryEntries.length} active entries fetched`);
  const allEntries = [...registryEntries];

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

  await checkLivenessOfRegistryCandidates(newCandidates);

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
      websiteUrl: c.websiteUrl,
      description: cleanListingDescription(c.description) || 'No description provided.',
      category: normalizeCategoryLite(c.category, c.name, c.description, c.url),
      isOfficial: c.url.toLowerCase().includes('github.com/modelcontextprotocol/servers'),
      // Official-registry candidates are already vetted by the registry's own
      // moderation policy — skip our admin queue and publish them directly,
      // unless the liveness pre-check above found the URL already dead.
      // Everything else keeps going through review, same as /api/submit.
      status: c.source === 'official-registry' && !c.liveCheckFailed ? 'active' : 'pending',
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  const sqlPath = path.join(process.cwd(), 'drizzle', `ingest-${date}.sql`);
  const esc = (s) => String(s).replace(/'/g, "''");

  let sql = '';
  for (const r of rows) {
    // created_at is stored in Unix *seconds* (matches scripts/seed-sql.mjs and the
    // Drizzle submit route) — do not multiply by 1000.
    const websiteUrlSql = r.websiteUrl ? `'${esc(r.websiteUrl)}'` : 'NULL';
    sql +=
      `INSERT INTO servers (id, name, url, website_url, description, category, is_official, status, created_at) ` +
      `VALUES ('${esc(r.id)}', '${esc(r.name)}', '${esc(r.url)}', ${websiteUrlSql}, '${esc(r.description)}', ` +
      `'${esc(r.category)}', ${r.isOfficial ? 1 : 0}, '${esc(r.status)}', strftime('%s', 'now')) ` +
      `ON CONFLICT(id) DO NOTHING;\n`;
  }

  fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
  fs.writeFileSync(sqlPath, sql);

  const relPath = path.relative(process.cwd(), sqlPath);
  const activeCount = rows.filter((r) => r.status === 'active').length;
  console.log(`\nWrote ${rows.length} new listings to ${relPath} (${activeCount} auto-active from the official registry, ${rows.length - activeCount} pending review).`);
  console.log('First up to 15 new listings:');
  for (const r of rows.slice(0, 15)) {
    console.log(`  - ${r.name}  (${r.category})  [${r.status}]  ${r.url}`);
  }

  if (AUTO_APPLY) {
    applySql(relPath);
    console.log('Applied.');
  } else {
    console.log(`\nReview the file, then apply it with:\n  npx wrangler d1 execute ${DB_NAME} --remote --file=${relPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
