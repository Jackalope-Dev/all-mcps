import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { findRepoIdentityMismatch } from './repoIdentity.mjs';

/**
 * Pulls newly-added listings from other public MCP server lists and stages them
 * for review.
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

// --only=<source1,source2> / --skip=<source1,source2> — operational kill switch so
// a source can be disabled from CI (the workflow file) without a code change, e.g.
// while a newly-added source's first few runs are still being reviewed manually.
// Source names match the `source` tag each fetcher stamps on its entries below
// ('official-registry', a SOURCES[].name, or 'pulsemcp').
function argListFlag(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg
    ? arg
        .slice(prefix.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
}
const ONLY_SOURCES = argListFlag('only');
const SKIP_SOURCES = argListFlag('skip') || [];
function sourceEnabled(name) {
  if (ONLY_SOURCES) return ONLY_SOURCES.includes(name);
  return !SKIP_SOURCES.includes(name);
}

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
// Confirmed live 2026-08-26: the registry has grown past 27,000 active entries and
// was hitting this cap when it was still 300 (30,000) — raised with headroom so the
// weekly cron doesn't silently start missing the tail again as it keeps growing.
const OFFICIAL_REGISTRY_MAX_PAGES = 2000; // 2000 * 100 = 200,000 servers

// PulseMCP (https://www.pulsemcp.com) — third-party MCP directory with a public,
// paginated JSON API (confirmed live 2026-08-26: GET .../v0beta/servers returns
// {servers, total_count, next}; ~22k entries vs. our ~11k rows). Unlike the official
// registry this has no moderation policy we've vetted, so candidates are NOT
// auto-approved, and — because the volume dwarfs the two README sources — get their
// own quality floor and per-run cap so the admin queue stays reviewable instead of
// getting flooded in one run.
const PULSEMCP_API_BASE = 'https://api.pulsemcp.com/v0beta/servers';
const PULSEMCP_PAGE_SIZE = 100;
const PULSEMCP_MAX_PAGES = 400; // 400 * 100 = 40,000 servers of headroom
const PULSEMCP_MIN_SIGNAL = { stars: 1, downloads: 50 };
const PULSEMCP_MAX_NEW_PER_RUN = 150;
const PULSEMCP_HOST_BLOCKLIST = ['pulsemcp.com', 'www.pulsemcp.com'];

const SOURCES = [
  {
    name: 'awesome-mcp-servers',
    readmeUrl:
      'https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md',
    // The README also has non-server ## sections (Clients, Tutorials, Community,
    // Frameworks, Tips and Tricks, ...) using the same bullet-link format —
    // restrict parsing to the one ## section that's an actual server list.
    sectionHeadingMatch: (text) => /server implementations/i.test(text),
  },
  {
    name: 'modelcontextprotocol/servers',
    readmeUrl:
      'https://raw.githubusercontent.com/modelcontextprotocol/servers/main/README.md',
    // Reference servers are listed as repo-relative paths (e.g. `src/everything`)
    // rather than full URLs — resolve those against the repo tree.
    baseTreeUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/',
    sectionHeadingMatch: (text) => /reference servers/i.test(text),
    // Deprecated/unmaintained reference servers — not worth ingesting.
    skipCategory: (category) => /archived/i.test(category),
  },
];

const DIRECTORY_CATEGORIES = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'lib', 'category-manifest.json'),
    'utf8',
  ),
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
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  )
    return false;

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
      .replace(
        /^(?:[\p{Extended_Pictographic}\s]|[\u{1F3FB}-\u{1F3FF}]|\uFE0F|\u200D)+/u,
        '',
      )
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
    regex:
      /\b(postgres|postgresql|mysql|sqlite|mongodb|redis|supabase|neon|clickhouse|cassandra|dynamodb|planetscale|cockroachdb|memcached|duckdb|snowflake|bigquery|couchdb|prisma|drizzle|sql|database|datastore|timescaledb|vectordb)\b/i,
  },
  {
    category: '💬 Communication',
    regex:
      /\b(slack|discord|telegram|whatsapp|email|gmail|sendgrid|resend|mailchimp|matrix|teams|twilio|zendesk|intercom|messaging|messenger|outlook)\b/i,
  },
  {
    category: '📂 Browser Automation',
    regex:
      /\b(playwright|puppeteer|selenium|browserbase|stagehand|headful|headless-browser|browser-automation|chromedp|web-browser|browser-use)\b/i,
  },
  {
    category: '🔎 Search & Data Extraction',
    regex:
      /\b(serper|tavily|brave-search|google-search|bing-search|duckduckgo|web-scraper|scraping|crawling|web-crawler|firecrawl|jina-ai|diffbot|web-extraction|web-search)\b/i,
  },
  {
    category: '🔄 Version Control',
    regex:
      /\b(github-api|github-issues|github-pulls|gitlab|bitbucket|gitea|git-repo|git-commit|version-control|subversion|mercurial)\b/i,
  },
  {
    category: '☁️ Cloud Platforms',
    regex:
      /\b(aws|amazon-web-services|gcp|google-cloud|azure|cloudflare|terraform|kubernetes|k8s|docker|vercel|netlify|digitalocean|heroku|cloud-infrastructure|aws-lambda|s3-bucket)\b/i,
  },
  {
    category: '📊 Monitoring',
    regex:
      /\b(sentry|datadog|prometheus|grafana|opentelemetry|logrocket|newrelic|pagerduty|uptime|logging|observability|metrics|alerting|statuspage)\b/i,
  },
  {
    category: '🏢 Workplace & Productivity',
    regex:
      /\b(jira|linear|trello|asana|notion|clickup|confluence|google-calendar|google-docs|todoist|airtable|workplace|google-sheets|excel)\b/i,
  },
  {
    category: '💰 Finance & Fintech',
    regex:
      /\b(stripe|shopify|plaid|crypto|solana|ethereum|bitcoin|base-chain|x402|stock-market|finance|financial|accounting|hledger|forex|sec-edgar|wallet|token|defi|fintech|sepa|exchange-rate)\b/i,
  },
  {
    category: '🧠 Knowledge & Memory',
    regex:
      /\b(pinecone|weaviate|qdrant|chroma|vector-db|vector-database|rag|memory|knowledge-base|obsidian|roam|logseq|mem0|zotero|notes|note-taking|embeddings)\b/i,
  },
  {
    category: '🔒 Security',
    regex:
      /\b(security-scan|vulnerability|vulnerabilities|secrets|vault|snyk|sonar|auth0|okta|pentest|penetration|cve|threat-analysis|cybersecurity|auth-type)\b/i,
  },
  {
    category: '🧬 Biology & Bioinformatics',
    regex:
      /\b(ncbi|blast|pubchem|dna|protein|bioinformatics|genomics|chembl|pdb|uniprot|medical|healthcare|biology)\b/i,
  },
  {
    category: '🎮 Gaming',
    regex:
      /\b(unity|unreal|minecraft|steam|game-engine|chess|poker|gaming|games)\b/i,
  },
  {
    category: '🎙️ Speech-to-Text',
    regex:
      /\b(whisper|speech-to-text|stt|transcription|transcribe|audio-transcription)\b/i,
  },
  {
    category: '🎧 Text-to-Speech',
    regex: /\b(elevenlabs|text-to-speech|tts|voice-synthesis)\b/i,
  },
  {
    category: '🎥 Multimedia Process',
    regex:
      /\b(ffmpeg|video-processing|video-editing|image-processing|opencv|sharp|yt-dlp|youtube-dl|audio-processing|media-processing)\b/i,
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
    regex:
      /\b(twitter|x-api|bluesky|mastodon|reddit|linkedin|facebook|instagram|tiktok|social-media)\b/i,
  },
  {
    category: '👨‍💻 Code Execution',
    regex: /\b(code-execution|python-interpreter|repl|sandbox|e2b|run-code)\b/i,
  },
  {
    category: '📂 File Systems',
    regex:
      /\b(filesystem|file-system|local-files|directory-tree|file-search|google-drive|dropbox|onedrive)\b/i,
  },
];

function inferCategoryFromSignals(name, description, rawUrl) {
  const cleanUrl = (rawUrl || '').replace(
    /^https?:\/\/(www\.)?github\.com\//i,
    '',
  );
  const text = `${name || ''} ${description || ''} ${cleanUrl}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.regex.test(text)) {
      return rule.category;
    }
  }
  return undefined; // fallback to DEFAULT_CATEGORY
}

function normalizeCategoryLite(input, fallbackName, fallbackDesc, fallbackUrl) {
  if (!input?.trim()) {
    return (
      inferCategoryFromSignals(fallbackName, fallbackDesc, fallbackUrl) ||
      DEFAULT_CATEGORY
    );
  }
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const exact = DIRECTORY_CATEGORIES.find((c) => c === raw);
  if (exact) return exact;

  const caseMatch = DIRECTORY_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (caseMatch) return caseMatch;

  const label = stripEmojiLabel(raw).toLowerCase();
  const labelMatch = DIRECTORY_CATEGORIES.find(
    (c) => stripEmojiLabel(c).toLowerCase() === label,
  );
  if (labelMatch) return labelMatch;

  const partial = DIRECTORY_CATEGORIES.find((c) => {
    const l = stripEmojiLabel(c).toLowerCase();
    return l === label || l.includes(label) || label.includes(l);
  });
  if (partial) return partial;

  return (
    inferCategoryFromSignals(fallbackName, fallbackDesc, fallbackUrl) ||
    DEFAULT_CATEGORY
  );
}

// --- dedup key + id slug ----------------------------------------------------

function normalizeUrlKey(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const p = u.pathname.replace(/\.git$/i, '').replace(/\/+$/, '');
    // Kept in sync with lib/urlDedup.ts — see the note there on stripping www.
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return `${host}${p.toLowerCase()}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

// --- package-identity dedup ------------------------------------------------
// Verbatim port of lib/urlDedup.ts's installEcosystemFromCommand/normalizePackageKey
// (same "plain Node ESM, no TS toolchain" reason normalizeUrlKey above is ported).
// Closes a gap URL-only dedup misses: the same npm/PyPI package can be listed
// under different repo/marketing URLs across sources.

function installEcosystemFromCommand(installCommand) {
  const cmd = (installCommand || '').toLowerCase();
  if (/npx|bunx|npm|pnpm|yarn/.test(cmd)) return 'npm';
  if (/uvx|pipx|pip\b|python/.test(cmd)) return 'pypi';
  return null;
}

function normalizePackageKey(ecosystem, packageName) {
  if (!ecosystem || !packageName) return null;
  const pkg = String(packageName).trim().toLowerCase();
  if (!pkg || pkg.startsWith('http')) return null;
  return `${ecosystem}:${pkg}`;
}

// --- multi-signal duplicate *flagging* (review-only, never auto-skip) ------
// Exact url/package identity above is the only thing allowed to silently drop
// a candidate — that's deliberately conservative. But it misses a real case:
// the same GitHub owner shipping what's clearly the same project name under a
// different repo/URL (a rename, a monorepo split, a fork under a new org).
// Corroborating signals (owner match + name match) raise confidence enough to
// flag it in the generated SQL/console for a human to look at, without ever
// silently merging or rejecting a possibly-distinct listing.

function parseGithubOwnerRepo(url) {
  const m = (url || '').match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  return {
    owner: m[1].toLowerCase(),
    repo: m[2].replace(/\.git$/i, '').toLowerCase(),
  };
}

/** Collapse a listing name to a bare identity key: lowercase, strip "mcp"/"server(s)" filler words and punctuation. */
function normalizeNameKey(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && w !== 'mcp' && w !== 'server' && w !== 'servers')
    .join(' ')
    .trim();
}

function domainOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Like domainOf, but never resolves to a code-hosting domain — those identify the repo host, not the project's own site, and must never count as a "website" match. */
function websiteDomainOf(url) {
  const d = domainOf(url);
  if (!d) return null;
  return /(^|\.)github\.com$|(^|\.)github\.io$|(^|\.)gitlab\.com$/i.test(d)
    ? null
    : d;
}

/** Bare package name for cross-ecosystem name comparison — excludes remote-install URLs (installPackage there is a URL, not a name). */
function barePackageName(installKind, installPackage) {
  if (installKind !== 'stdio' || !installPackage) return null;
  return String(installPackage).trim().toLowerCase();
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      // Cloudflare Vectorize caps vector IDs (this slug) at 64 bytes.
      .slice(0, 64)
      .replace(/-+$/, '') || `mcp-${Date.now()}`
  );
}

// --- fetch + parse -----------------------------------------------------------

async function fetchReadme(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'AllMCPs-Ingest' } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

const HEADING_RE = /^(#{2,4})\s+(.*)$/;
const ITEM_RE =
  /^[-*]\s*(?:\*\*)?\[([^\]]+)\]\(([^)]+)\)(?:\*\*)?\s*(?:[-–—:])?\s*(.*)$/;

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
        inSection = source.sectionHeadingMatch
          ? source.sectionHeadingMatch(cleaned)
          : true;
        continue;
      }

      if (inSection && cleaned) {
        currentCategory = cleaned;
        skipCurrentCategory = source.skipCategory
          ? source.skipCategory(cleaned)
          : false;
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

    entries.push({
      name,
      url,
      description,
      category: currentCategory,
      source: source.name,
    });
  }

  return entries;
}

// --- official MCP Registry (JSON API, not markdown) -----------------------

// The registry's `server.name` is namespaced (e.g. "io.github.acme/mcp"), but
// plenty of publishers pick a generic leaf like "mcp" or "mcp-server" inside
// their own namespace — every one of those collides down to the same handful
// of indistinguishable listing names (confirmed 2026-09-07: 149 pending rows
// from a single ingest run named just "mcp" or "mcp-server"). Falls back to
// the GitHub owner/repo, matching the recovery lib/displayName.ts already
// does for *display* — this fixes the name at the source instead of relying
// on every render path to remember to call parseServerName().
const GENERIC_REGISTRY_LEAF_NAMES = new Set(['mcp', 'mcp-server', 'server']);

function deriveOfficialRegistryName(server, primaryUrl) {
  if (server.title) return server.title;
  const leaf = server.name?.split('/').pop();
  if (leaf && GENERIC_REGISTRY_LEAF_NAMES.has(leaf.toLowerCase())) {
    const m = primaryUrl?.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (m) {
      return `${m[1]}/${m[2].replace(/\.git$/i, '')}`;
    }
  }
  return leaf || server.name;
}

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

    const res = await fetch(url, {
      headers: { 'User-Agent': 'AllMCPs-Ingest' },
    });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const body = await res.json();

    for (const entry of body.servers ?? []) {
      const server = entry.server;
      if (!server) continue;

      // Only ingest servers the registry itself currently considers active —
      // 'deprecated'/'deleted' status typically means spam, malware, or a
      // moderation-policy violation (per the aggregators doc).
      const registryStatus =
        entry._meta?.['io.modelcontextprotocol.registry/official']?.status;
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

      const name = deriveOfficialRegistryName(server, primaryUrl);
      const desc = server.description || '';
      entries.push({
        name,
        url: primaryUrl,
        description: desc,
        category: inferCategoryFromSignals(name, desc, primaryUrl), // Infers specific category or falls back to DEFAULT_CATEGORY
        websiteUrl:
          server.websiteUrl && server.websiteUrl !== primaryUrl
            ? server.websiteUrl
            : undefined,
        source: 'official-registry',
      });
    }

    cursor = body.metadata?.nextCursor;
    page++;
  } while (cursor && page < OFFICIAL_REGISTRY_MAX_PAGES);

  if (page >= OFFICIAL_REGISTRY_MAX_PAGES && cursor) {
    console.warn(
      `  official-registry: hit the ${OFFICIAL_REGISTRY_MAX_PAGES}-page safety cap with more pages remaining.`,
    );
  }
  if (skippedNoUrl)
    console.log(
      `  official-registry: skipped ${skippedNoUrl} entries with no usable URL.`,
    );
  if (skippedInactive)
    console.log(
      `  official-registry: skipped ${skippedInactive} non-active entries.`,
    );

  return entries;
}

// --- PulseMCP (JSON API, not markdown) --------------------------------------

function isPulseMcpOwnUrl(url) {
  try {
    return PULSEMCP_HOST_BLOCKLIST.includes(
      new URL(url).hostname.toLowerCase(),
    );
  } catch {
    return false;
  }
}

/**
 * PulseMCP's ~22k entries dwarf our ~11k rows — an unfiltered first run would dump
 * thousands of zero-signal candidates (empty forks, one-off scripts) into the admin
 * queue at once. This is a soft floor, not a strict bar: any one of a handful of
 * "this looks like a real, used project" signals is enough to pass.
 */
function pulseMcpPassesQualityFloor(entry) {
  if ((entry.github_stars ?? 0) >= PULSEMCP_MIN_SIGNAL.stars) return true;
  if ((entry.package_download_count ?? 0) >= PULSEMCP_MIN_SIGNAL.downloads)
    return true;
  if (Array.isArray(entry.remotes) && entry.remotes.length > 0) return true;
  if (entry.external_url && !isPulseMcpOwnUrl(entry.external_url)) return true;
  return false;
}

/**
 * PulseMCP gives structured package/remote fields directly — resolve install config
 * from those now instead of waiting on the enrich cron's README-parse heuristic.
 * Unrecognized package_registry values (anything besides npm/PyPI) are left unset;
 * the enrich cron already handles that case for every other source today.
 */
function pulseMcpInstallFields(entry) {
  const pkg = (entry.package_name || '').trim();
  const registry = (entry.package_registry || '').toLowerCase();
  const remote = Array.isArray(entry.remotes) ? entry.remotes[0] : null;
  const out = {};

  if (registry === 'npm' && pkg) {
    out.installKind = 'stdio';
    out.installCommand = 'npx';
    out.installArgs = ['-y', pkg];
    out.installPackage = pkg;
    out.installConfidence = 'high';
    if (typeof entry.package_download_count === 'number')
      out.npmDownloads = entry.package_download_count;
  } else if (registry === 'pypi' && pkg) {
    out.installKind = 'stdio';
    out.installCommand = 'uvx';
    out.installArgs = [pkg];
    out.installPackage = pkg;
    out.installConfidence = 'high';
  } else if (remote?.url_direct) {
    out.installKind = 'remote';
    out.installPackage = remote.url_direct;
    out.installConfidence = 'high';
  }

  // Secondary connection method alongside whichever primary install branch fired
  // above (see db/schema.ts's remoteEndpointUrl comment) — set whenever a remote
  // exists, independent of package_registry.
  if (remote?.url_direct) out.remoteEndpointUrl = remote.url_direct;

  return out;
}

// Confirmed live 2026-08-26: repeated identical requests to this API alternate
// between 200 and 410 with no discernible pattern (not a page-size or offset
// limit — verified by re-requesting the exact same URL and getting different
// results). Treated as a flaky third-party dependency: retry each page a few
// times before giving up on it.
const PULSEMCP_FETCH_RETRIES = 3;
const PULSEMCP_RETRY_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPulseMcpPage(url) {
  let lastErr;
  for (let attempt = 1; attempt <= PULSEMCP_FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AllMCPs-Ingest' },
      });
      if (res.ok) return await res.json();
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (attempt < PULSEMCP_FETCH_RETRIES)
      await sleep(PULSEMCP_RETRY_DELAY_MS * attempt);
  }
  throw lastErr;
}

async function fetchPulseMcpEntries() {
  const entries = [];
  let url = `${PULSEMCP_API_BASE}?count_per_page=${PULSEMCP_PAGE_SIZE}&offset=0`;
  let page = 0;
  let skippedNoUrl = 0;
  let skippedLowSignal = 0;

  while (url && page < PULSEMCP_MAX_PAGES) {
    let body;
    try {
      body = await fetchPulseMcpPage(url);
    } catch (err) {
      // A flaky page shouldn't sacrifice everything fetched so far, or (more
      // importantly) take down the official-registry/README sources — the
      // caller in main() already isolates this fetch in its own try/catch,
      // but bail out of pagination gracefully here too so a mid-run failure
      // still yields whatever was already collected instead of nothing.
      console.warn(
        `  pulsemcp: giving up on pagination after a page failed (${err.message}); keeping ${entries.length} entries collected so far.`,
      );
      break;
    }

    for (const entry of body.servers ?? []) {
      if (!pulseMcpPassesQualityFloor(entry)) {
        skippedLowSignal++;
        continue;
      }

      const remote = Array.isArray(entry.remotes) ? entry.remotes[0] : null;
      // Never the pulsemcp.com detail-page URL itself — that's their directory
      // page, not the project's own repo/site.
      const primaryUrl =
        entry.source_code_url ||
        remote?.url_direct ||
        (entry.external_url && !isPulseMcpOwnUrl(entry.external_url)
          ? entry.external_url
          : null);
      if (!primaryUrl) {
        skippedNoUrl++;
        continue;
      }

      const name = entry.name;
      const desc =
        entry.short_description ||
        entry.EXPERIMENTAL_ai_generated_description ||
        '';
      const websiteUrl =
        entry.external_url &&
        entry.external_url !== primaryUrl &&
        !isPulseMcpOwnUrl(entry.external_url) &&
        !/github\.com/i.test(entry.external_url)
          ? entry.external_url
          : undefined;

      entries.push({
        name,
        url: primaryUrl,
        description: desc,
        category: inferCategoryFromSignals(name, desc, primaryUrl),
        websiteUrl,
        source: 'pulsemcp',
        githubStars: /github\.com/i.test(primaryUrl)
          ? (entry.github_stars ?? undefined)
          : undefined,
        // Sort keys for the per-run cap below — kept separate from githubStars
        // since githubStars is only set for GitHub-primary listings, but the cap
        // should still rank non-GitHub (remote-only) candidates sensibly.
        sortStars: entry.github_stars ?? 0,
        sortDownloads: entry.package_download_count ?? 0,
        ...pulseMcpInstallFields(entry),
      });
    }

    url = body.next || null;
    page++;
  }

  if (page >= PULSEMCP_MAX_PAGES && url) {
    console.warn(
      `  pulsemcp: hit the ${PULSEMCP_MAX_PAGES}-page safety cap with more pages remaining.`,
    );
  }
  if (skippedNoUrl)
    console.log(
      `  pulsemcp: skipped ${skippedNoUrl} entries with no usable URL.`,
    );
  if (skippedLowSignal)
    console.log(
      `  pulsemcp: skipped ${skippedLowSignal} entries below the quality floor.`,
    );

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
const LIVENESS_TIMEOUT_MS = 8000;
// Confirmed 2026-09-07: at concurrency 10 with no pacing, blasting ~13.5k HEAD
// requests at github.com from a single CI runner IP in ~10 minutes trips
// GitHub's abuse/rate-limit protection partway through — every request after
// that point fails (network error, not a real 404), and since checkLive()
// used to treat *any* failure as "dead", 68% of genuinely-live repos got
// wrongly demoted from 'active' to 'pending' in one run (9,183 of 13,551).
// Lower concurrency + spacing between batches keeps us under that threshold.
const LIVENESS_CONCURRENCY = 4;
const LIVENESS_BATCH_DELAY_MS = 150;
const LIVENESS_RETRIES = 2;
const LIVENESS_RETRY_BASE_DELAY_MS = 500;
// Only these mean "this URL is confirmed gone" — everything else (timeouts,
// network errors, 429/5xx, other 4xx) is ambiguous and usually means *we*
// got throttled, not that the repo doesn't exist, so it gets retried instead
// of trusted on the first failure.
const LIVENESS_DEAD_STATUSES = new Set([404, 410, 451]);

async function checkLiveOnce(url) {
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
      return { alive: getRes.ok, status: getRes.status };
    }
    return { alive: res.ok, status: res.status };
  } catch {
    return { alive: false, status: null };
  }
}

async function checkLive(url) {
  for (let attempt = 0; attempt <= LIVENESS_RETRIES; attempt++) {
    const result = await checkLiveOnce(url);
    if (result.alive) return true;
    if (result.status !== null && LIVENESS_DEAD_STATUSES.has(result.status)) {
      return false; // confirmed gone — no point retrying
    }
    if (attempt < LIVENESS_RETRIES) {
      await sleep(LIVENESS_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  // Exhausted retries without a confirmed-dead status either way — still
  // ambiguous, not confirmed dead. Fall through to the caller's default,
  // which demotes to 'pending' for a human to look at rather than either
  // auto-publishing an unverified link or discarding a possibly-live one.
  return false;
}

// official-registry candidates otherwise auto-publish as 'active' (a failed check
// demotes them to 'pending'); pulsemcp candidates always land 'pending' regardless,
// but a failed check there means "confirmed dead" — see main()'s use of this flag,
// which drops those entirely rather than queuing a dead link for admin review.
const LIVE_CHECK_SOURCES = new Set(['official-registry', 'pulsemcp']);

async function checkLivenessOfNewCandidates(candidates) {
  const toCheck = candidates.filter((c) => LIVE_CHECK_SOURCES.has(c.source));
  if (toCheck.length === 0) return;
  console.log(
    `Live-checking ${toCheck.length} new official-registry/pulsemcp candidates...`,
  );

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
    if (i + LIVENESS_CONCURRENCY < toCheck.length) {
      await sleep(LIVENESS_BATCH_DELAY_MS);
    }
  }
  if (deadCount > 0) {
    console.log(
      `  ${deadCount} of ${toCheck.length} appear dead on arrival — landing as 'pending' for review instead of 'active'.`,
    );
  }
}

// --- live DB lookup / apply ------------------------------------------------

// CLOUDFLARE_API_TOKEN, when present (e.g. in the registry-sync CI workflow),
// makes wrangler authenticate non-interactively instead of needing a prior
// `npx wrangler login`. Passed through untouched via `...process.env`.
const WRANGLER_ENV = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };

function queryExisting() {
  const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --json --command "SELECT id, name, url, website_url, install_kind, install_command, install_package FROM servers"`;
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
        'AllMCPs Cloudflare account (or set CLOUDFLARE_API_TOKEN) and try again.',
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
  const allEntries = [];

  if (sourceEnabled('official-registry')) {
    const registryEntries = await fetchOfficialRegistryEntries();
    console.log(
      `  official-registry: ${registryEntries.length} active entries fetched`,
    );
    allEntries.push(...registryEntries);
  }

  for (const source of SOURCES) {
    if (!sourceEnabled(source.name)) continue;
    const md = await fetchReadme(source.readmeUrl);
    const entries = parseServerList(md, source);
    console.log(`  ${source.name}: ${entries.length} entries parsed`);
    allEntries.push(...entries);
  }

  if (sourceEnabled('pulsemcp')) {
    try {
      const pulsemcpEntries = await fetchPulseMcpEntries();
      console.log(
        `  pulsemcp: ${pulsemcpEntries.length} entries above the quality floor`,
      );
      allEntries.push(...pulsemcpEntries);
    } catch (err) {
      // Isolated deliberately: pulsemcp's API has observed intermittent failures
      // (see fetchPulseMcpPage) and is not a source we're vetting the reliability
      // of the way the official registry has been — a bad run there should never
      // sacrifice the official-registry/README ingestion that already succeeded.
      console.warn(
        `  pulsemcp: skipping this run entirely — fetch failed: ${err.message}`,
      );
    }
  }

  const byUrlKey = new Map();
  const seenPackageKeys = new Map();
  for (const e of allEntries) {
    if (!isSafeSubmissionUrl(e.url)) continue;
    const key = normalizeUrlKey(e.url);
    if (byUrlKey.has(key)) continue;

    const pkgKey =
      e.installKind === 'stdio'
        ? normalizePackageKey(
            installEcosystemFromCommand(e.installCommand),
            e.installPackage,
          )
        : null;
    if (pkgKey && seenPackageKeys.has(pkgKey)) continue;

    byUrlKey.set(key, { ...e, urlKey: key, packageKey: pkgKey });
    if (pkgKey) seenPackageKeys.set(pkgKey, key);
  }
  console.log(`Deduped to ${byUrlKey.size} unique candidates across sources.`);

  console.log('Querying live DB for existing urls/ids...');
  const existing = queryExisting();
  const existingUrlKeys = new Set(existing.map((r) => normalizeUrlKey(r.url)));
  const existingPackageKeys = new Set(
    existing
      .map((r) =>
        normalizePackageKey(
          installEcosystemFromCommand(r.install_command),
          r.install_package,
        ),
      )
      .filter(Boolean),
  );
  const usedIds = new Set(existing.map((r) => r.id));
  console.log(`  ${existing.length} servers already on file.`);

  // Corroborating (review-only) signals for the duplicate-confidence flag below.
  // Name alone is deliberately NOT enough to flag on its own — two unrelated
  // authors can genuinely both ship a "Polymarket MCP". It only counts once
  // paired with something much harder to coincidentally share: the same
  // GitHub owner, the same package name, or the same website domain.
  const existingByOwner = new Map(); // github owner -> [{id, url, nameKey}]
  const existingByNameKey = new Map(); // nameKey -> [{id, url, websiteDomain, packageName}]
  // How many *distinct* existing listings already use a given website domain —
  // confirmed live (2026-08-26) that generic reference links get stored as
  // website_url across many unrelated servers (docs.astral.sh/uv: 36 listings;
  // registry.modelcontextprotocol.io: 32; nodejs.org: 28; python.org: 22) and,
  // more subtly, many independent wrappers around the same third-party service
  // legitimately cite that service's own site (e.g. weather.gov, sui.io) as
  // their "website" — same domain there means "wraps the same API," not "same
  // author." A domain this common carries no identity signal, so it must be
  // near-unique in the catalog before it's allowed to corroborate a name match.
  const domainUsageCount = new Map();
  for (const r of existing) {
    const nameKey = normalizeNameKey(r.name);
    const gh = parseGithubOwnerRepo(r.url);
    if (gh) {
      if (!existingByOwner.has(gh.owner)) existingByOwner.set(gh.owner, []);
      existingByOwner.get(gh.owner).push({ id: r.id, url: r.url, nameKey });
    }

    const websiteDomain = websiteDomainOf(r.website_url);
    if (websiteDomain)
      domainUsageCount.set(
        websiteDomain,
        (domainUsageCount.get(websiteDomain) || 0) + 1,
      );

    if (nameKey) {
      if (!existingByNameKey.has(nameKey)) existingByNameKey.set(nameKey, []);
      existingByNameKey.get(nameKey).push({
        id: r.id,
        url: r.url,
        websiteDomain,
        packageName: barePackageName(r.install_kind, r.install_package),
      });
    }
  }
  // A domain only corroborates identity when it's exclusive to the one
  // existing listing being compared against — not shared by any other
  // unrelated entry already in the catalog.
  const isDistinctiveDomain = (domain) =>
    !!domain && (domainUsageCount.get(domain) || 0) <= 1;

  function findPossibleDuplicate(candidate) {
    const nameKey = normalizeNameKey(candidate.name);
    if (!nameKey) return null;

    const gh = parseGithubOwnerRepo(candidate.url);
    if (gh) {
      const sameOwner = existingByOwner.get(gh.owner) || [];
      const ownerMatch = sameOwner.find((e) => e.nameKey === nameKey);
      if (ownerMatch)
        return {
          id: ownerMatch.id,
          url: ownerMatch.url,
          reason: 'same GitHub owner + same name',
        };
    }

    const sameName = existingByNameKey.get(nameKey) || [];
    if (sameName.length === 0) return null;

    const candidateDomain =
      domainOf(candidate.websiteUrl) || websiteDomainOf(candidate.url);
    const candidatePackage = barePackageName(
      candidate.installKind,
      candidate.installPackage,
    );

    const domainMatch =
      isDistinctiveDomain(candidateDomain) &&
      sameName.find((e) => e.websiteDomain === candidateDomain);
    if (domainMatch)
      return {
        id: domainMatch.id,
        url: domainMatch.url,
        reason: 'same name + same website domain',
      };

    const packageMatch =
      candidatePackage &&
      sameName.find((e) => e.packageName === candidatePackage);
    if (packageMatch)
      return {
        id: packageMatch.id,
        url: packageMatch.url,
        reason: 'same name + same package name',
      };

    // Name matched but nothing else corroborated it — too weak to flag on its
    // own (see comment above); silently allow it through as a distinct listing.
    return null;
  }

  const newCandidates = [...byUrlKey.values()].filter(
    (c) =>
      !existingUrlKeys.has(c.urlKey) &&
      !(c.packageKey && existingPackageKeys.has(c.packageKey)),
  );
  console.log(`${newCandidates.length} candidates are not yet in the catalog.`);

  if (newCandidates.length === 0) {
    console.log('Nothing new to add.');
    return;
  }

  await checkLivenessOfNewCandidates(newCandidates);

  const deadPulsemcp = newCandidates.filter(
    (c) => c.source === 'pulsemcp' && c.liveCheckFailed,
  ).length;
  if (deadPulsemcp > 0) {
    console.log(
      `  pulsemcp: dropping ${deadPulsemcp} dead-on-arrival candidates instead of queuing them for review.`,
    );
  }
  let finalCandidates = newCandidates.filter(
    (c) => !(c.source === 'pulsemcp' && c.liveCheckFailed),
  );

  const pulsemcpCandidates = finalCandidates
    .filter((c) => c.source === 'pulsemcp')
    .sort(
      (a, b) => b.sortStars - a.sortStars || b.sortDownloads - a.sortDownloads,
    );
  if (pulsemcpCandidates.length > PULSEMCP_MAX_NEW_PER_RUN) {
    const heldBack = pulsemcpCandidates.length - PULSEMCP_MAX_NEW_PER_RUN;
    console.log(
      `  pulsemcp: capping this run to the top ${PULSEMCP_MAX_NEW_PER_RUN} by stars/downloads (${heldBack} held back for a future run).`,
    );
    const keepUrlKeys = new Set(
      pulsemcpCandidates
        .slice(0, PULSEMCP_MAX_NEW_PER_RUN)
        .map((c) => c.urlKey),
    );
    finalCandidates = finalCandidates.filter(
      (c) => c.source !== 'pulsemcp' || keepUrlKeys.has(c.urlKey),
    );
  }

  let dupWarningCount = 0;
  let repoWarningCount = 0;
  const rows = [];
  for (const c of finalCandidates) {
    const base = slugify(c.name);
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n++}`;
    }
    usedIds.add(id);

    // Checked against both the live DB and every candidate already accepted
    // this run (registered into the same maps right after, below) — catches
    // two *new* sources introducing what looks like the same project too.
    const dup = findPossibleDuplicate(c);
    if (dup) dupWarningCount++;

    // Separate from the duplicate check: this catches a candidate pointing at
    // a popular repo that has nothing to do with its name — the shape that put
    // three listings in the catalog ranking on other projects' stars.
    const repoMismatch = findRepoIdentityMismatch(c);
    if (repoMismatch) repoWarningCount++;

    rows.push({
      id,
      dupWarning: dup
        ? `possible duplicate of '${dup.id}' (${dup.reason}): ${dup.url}`
        : null,
      repoWarning: repoMismatch,
      name: c.name,
      url: c.url,
      websiteUrl: c.websiteUrl,
      description:
        cleanListingDescription(c.description) || 'No description provided.',
      category: normalizeCategoryLite(c.category, c.name, c.description, c.url),
      isOfficial: c.url
        .toLowerCase()
        .includes('github.com/modelcontextprotocol/servers'),
      // Official-registry candidates are already vetted by the registry's own
      // moderation policy — skip our admin queue and publish them directly,
      // unless the liveness pre-check above found the URL already dead.
      // Everything else keeps going through review, same as /api/submit.
      status:
        c.source === 'official-registry' && !c.liveCheckFailed
          ? 'active'
          : 'pending',
      // Structured signals pulsemcp gives us directly — pre-populated now instead
      // of waiting on the health/enrich crons' README-parse heuristics. Every
      // other source simply leaves these undefined, which serializes to NULL below.
      githubStars: c.githubStars,
      npmDownloads: c.npmDownloads,
      installKind: c.installKind,
      installCommand: c.installCommand,
      installArgs: c.installArgs,
      installPackage: c.installPackage,
      installConfidence: c.installConfidence,
      remoteEndpointUrl: c.remoteEndpointUrl,
    });

    // Register this now-accepted candidate so a *later* candidate in this same
    // run (from a different source) also gets checked against it.
    const nameKey = normalizeNameKey(c.name);
    const gh = parseGithubOwnerRepo(c.url);
    if (gh) {
      if (!existingByOwner.has(gh.owner)) existingByOwner.set(gh.owner, []);
      existingByOwner.get(gh.owner).push({ id, url: c.url, nameKey });
    }
    const acceptedDomain = domainOf(c.websiteUrl) || websiteDomainOf(c.url);
    if (acceptedDomain)
      domainUsageCount.set(
        acceptedDomain,
        (domainUsageCount.get(acceptedDomain) || 0) + 1,
      );
    if (nameKey) {
      if (!existingByNameKey.has(nameKey)) existingByNameKey.set(nameKey, []);
      existingByNameKey.get(nameKey).push({
        id,
        url: c.url,
        websiteDomain: acceptedDomain,
        packageName: barePackageName(c.installKind, c.installPackage),
      });
    }
  }
  if (dupWarningCount > 0) {
    console.log(
      `  ⚠ ${dupWarningCount} candidate(s) flagged as possible duplicates — review before applying (see comments in the generated SQL).`,
    );
  }
  if (repoWarningCount > 0) {
    console.log(
      `  ⚠ ${repoWarningCount} candidate(s) point at a popular repo unrelated to their name — review before applying (see comments in the generated SQL).`,
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const sqlPath = path.join(process.cwd(), 'drizzle', `ingest-${date}.sql`);
  const esc = (s) => String(s).replace(/'/g, "''");
  const strOrNull = (s) => (s ? `'${esc(s)}'` : 'NULL');
  const numOrNull = (n) =>
    typeof n === 'number' && Number.isFinite(n) ? String(n) : 'NULL';

  let sql = '';
  for (const r of rows) {
    // created_at is stored in Unix *seconds* (matches scripts/seed-sql.mjs and the
    // Drizzle submit route) — do not multiply by 1000.
    const installArgsJson = r.installArgs
      ? JSON.stringify(r.installArgs)
      : null;
    if (r.dupWarning) sql += `-- ⚠ ${r.dupWarning}\n`;
    sql +=
      `INSERT INTO servers (id, name, url, website_url, description, category, is_official, status, ` +
      `github_stars, npm_downloads, install_kind, install_command, install_args, install_package, ` +
      `install_confidence, remote_endpoint_url, created_at) ` +
      `VALUES ('${esc(r.id)}', '${esc(r.name)}', '${esc(r.url)}', ${strOrNull(r.websiteUrl)}, '${esc(r.description)}', ` +
      `'${esc(r.category)}', ${r.isOfficial ? 1 : 0}, '${esc(r.status)}', ` +
      `${numOrNull(r.githubStars)}, ${numOrNull(r.npmDownloads)}, ${strOrNull(r.installKind)}, ` +
      `${strOrNull(r.installCommand)}, ${strOrNull(installArgsJson)}, ${strOrNull(r.installPackage)}, ` +
      `${strOrNull(r.installConfidence)}, ${strOrNull(r.remoteEndpointUrl)}, strftime('%s', 'now')) ` +
      `ON CONFLICT(id) DO NOTHING;\n`;
  }

  fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
  fs.writeFileSync(sqlPath, sql);

  const relPath = path.relative(process.cwd(), sqlPath);
  const activeCount = rows.filter((r) => r.status === 'active').length;
  const bySource = finalCandidates.reduce((acc, c) => {
    acc[c.source] = (acc[c.source] || 0) + 1;
    return acc;
  }, {});
  console.log(
    `\nWrote ${rows.length} new listings to ${relPath} (${activeCount} auto-active from the official registry, ${rows.length - activeCount} pending review).`,
  );
  console.log(
    `  By source: ${Object.entries(bySource)
      .map(([s, n]) => `${s}=${n}`)
      .join(', ')}`,
  );
  console.log('First up to 15 new listings:');
  for (const r of rows.slice(0, 15)) {
    console.log(
      `  - ${r.name}  (${r.category})  [${r.status}]  ${r.url}${r.dupWarning ? `  ⚠ ${r.dupWarning}` : ''}${r.repoWarning ? `  ⚠ ${r.repoWarning}` : ''}`,
    );
  }

  if (AUTO_APPLY) {
    applySql(relPath);
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
