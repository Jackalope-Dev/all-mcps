/**
 * Full-site IndexNow submission with priority ordering:
 *   1) core hubs (homepage, guides, categories, blog, tools, trust, …)
 *   2) listing detail pages
 *   3) secondary (alternatives + compare)
 *
 * Core goes first so Bing/Yandex crawl high-ROI URLs before the long tail.
 *
 * ⚠️  MANUAL / BOOTSTRAP USE ONLY. This submits the whole site. Run it once for
 * a new site, after a key rotation, or when Bing asks for a fresh re-crawl —
 * never on a schedule. Resubmitting every URL daily is what puts an IndexNow
 * key into "batch mode", which Bing recommends against. Routine change signals
 * come from the real-time approve/republish pings (lib/indexnow.ts) and the
 * change-scoped daily cron (app/api/cron/indexnow/route.ts).
 *
 * Usage: npm run submit-index
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const BASE_URL = 'https://allmcps.com';
const INDEXNOW_KEY = 'c7fa82e1d09b4f658a2e3f4b5c6d7e8f';
const KEY_LOCATION = `${BASE_URL}/${INDEXNOW_KEY}.txt`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Mirrors lib/sitemapHelpers INDEXNOW_CORE_PATHS + extra static hubs. */
const CORE_STATIC = [
  '',
  '/browse',
  '/categories',
  '/best',
  '/clients',
  '/about',
  '/docs/api',
  '/blog',
  '/contact',
  '/submit',
  '/terms',
  '/privacy',
  '/guides',
  '/what-is-mcp',
  '/guide',
  '/build-mcp-server',
  '/mcp-security',
  '/deploy-mcp-server',
  '/mcp-troubleshooting',
  '/pricing',
  '/tools',
  '/tools/config-auditor',
  '/tools/config-generator',
  '/tools/config-validator',
  '/tools/openapi-to-mcp',
  '/tools/playground',
  '/tools/protocol-inspector',
  '/tools/token-calculator',
  '/prompts',
  '/prompts/fullstack-developer',
  '/prompts/research-agent',
  '/prompts/devops-engineer',
  '/prompts/data-analyst',
  '/prompts/product-ops',
  '/badge-generator',
  '/mcp-for-cursor',
  '/mcp-for-claude-desktop',
  '/mcp-for-windsurf',
  '/mcp-for-cline',
  '/trust',
];

function collectUrlBuckets() {
  const core = [];
  const listings = [];
  const secondary = [];
  const seen = new Set();

  function add(bucket, url) {
    if (seen.has(url)) return;
    seen.add(url);
    bucket.push(url);
  }

  for (const route of CORE_STATIC) {
    add(core, `${BASE_URL}${route}`);
  }

  // Blog posts → core
  const blogDir = path.join(rootDir, 'content', 'blog');
  if (fs.existsSync(blogDir)) {
    const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.md'));
    const pattern = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;
    for (const file of files) {
      const match = file.match(pattern);
      if (match) add(core, `${BASE_URL}/blog/${match[2]}`);
    }
  }

  // Category hubs → core
  const catManifestPath = path.join(rootDir, 'lib', 'category-manifest.json');
  if (fs.existsSync(catManifestPath)) {
    try {
      const categories = JSON.parse(fs.readFileSync(catManifestPath, 'utf8'));
      for (const cat of categories) {
        const clean = String(cat)
          .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s]+/u, '')
          .toLowerCase()
          .replace(/&/g, ' and ')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (clean) add(core, `${BASE_URL}/categories/${clean}`);
      }
    } catch (e) {
      console.error('Error parsing category-manifest.json:', e.message);
    }
  }

  // Best / clients from known paths (bestTopics not imported — light static scan)
  // Best topics: try reading TS is hard; list category slugs already cover most hubs.
  // Clients pages are few — add common ones if clients module isn't available.
  try {
    const clientsPath = path.join(rootDir, 'lib', 'clients.ts');
    if (fs.existsSync(clientsPath)) {
      const src = fs.readFileSync(clientsPath, 'utf8');
      const slugMatches = src.matchAll(/slug:\s*['"]([a-z0-9-]+)['"]/g);
      for (const m of slugMatches) {
        add(core, `${BASE_URL}/clients/${m[1]}`);
      }
    }
  } catch {
    /* optional */
  }

  try {
    const bestPath = path.join(rootDir, 'lib', 'bestTopics.ts');
    if (fs.existsSync(bestPath)) {
      const src = fs.readFileSync(bestPath, 'utf8');
      const slugMatches = src.matchAll(/slug:\s*['"]([a-z0-9-]+)['"]/g);
      for (const m of slugMatches) {
        add(core, `${BASE_URL}/best/${m[1]}`);
      }
    }
  } catch {
    /* optional */
  }

  // Listings (active indexable servers)
  const serversPath = path.join(rootDir, 'data', 'mcp-servers.json');
  if (fs.existsSync(serversPath)) {
    try {
      const serversData = JSON.parse(fs.readFileSync(serversPath, 'utf8'));
      if (Array.isArray(serversData)) {
        for (const server of serversData) {
          if (!server.id || server.status === 'removed') continue;
          add(listings, `${BASE_URL}/mcp/${server.id}`);
        }
      }
    } catch (err) {
      console.error('Error reading mcp-servers.json:', err.message);
    }
  }

  return { core, listings, secondary };
}

async function submitBatch(urlBatch, label) {
  const payload = {
    host: 'allmcps.com',
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: urlBatch,
  };

  console.log(`Submitting ${label} (${urlBatch.length} URLs)...`);

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 200 || res.status === 202) {
      console.log(`✓ ${label} accepted (Status ${res.status}).`);
      return true;
    }
    const responseText = await res.text();
    console.error(`✗ ${label} failed with status ${res.status}: ${responseText}`);
    return false;
  } catch (err) {
    console.error(`✗ ${label} network error:`, err.message);
    return false;
  }
}

/** IndexNow allows up to 10k URLs per request; we batch smaller for clarity. */
const BATCH_SIZE = 1000;

async function submitBucket(urls, bucketName) {
  if (urls.length === 0) {
    console.log(`(skip ${bucketName} — empty)`);
    return;
  }
  const totalBatches = Math.ceil(urls.length / BATCH_SIZE);
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    await submitBatch(batch, `${bucketName} batch ${batchNum}/${totalBatches}`);
    // Brief pause between batches to be polite
    if (i + BATCH_SIZE < urls.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

async function main() {
  console.log('🚀 Gathering site URLs for prioritised IndexNow submission...');
  const { core, listings, secondary } = collectUrlBuckets();
  console.log(
    `Found core=${core.length}, listings=${listings.length}, secondary=${secondary.length} (total ${core.length + listings.length + secondary.length}).`
  );

  // Priority order: core → listings → secondary
  await submitBucket(core, 'core');
  await submitBucket(listings, 'listings');
  await submitBucket(secondary, 'secondary');

  console.log('\n🎉 Finished IndexNow submission process!');
}

main();
