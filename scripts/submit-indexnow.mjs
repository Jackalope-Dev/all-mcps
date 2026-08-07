/**
 * Full-site IndexNow submission with priority ordering:
 *   1) core hubs (homepage, guides, categories, blog, tools, trust, …)
 *   2) listing detail pages
 *   3) secondary (alternatives + compare)
 *
 * Core goes first so Bing/Yandex crawl high-ROI URLs before the long tail.
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

  // Listings + secondary
  const serversPath = path.join(rootDir, 'data', 'mcp-servers.json');
  if (fs.existsSync(serversPath)) {
    try {
      const serversData = JSON.parse(fs.readFileSync(serversPath, 'utf8'));
      if (Array.isArray(serversData)) {
        for (const server of serversData) {
          if (!server.id) continue;
          add(listings, `${BASE_URL}/mcp/${server.id}`);
          add(secondary, `${BASE_URL}/mcp/${server.id}/alternatives`);
        }

        const engagement = (s) =>
          (s.upvotes || 0) * 5 +
          (s.copies || 0) +
          (s.views || 0) * 0.05 +
          Math.min(Math.log10(1 + (s.githubStars || s.stars || 0)) * 3, 15) +
          Math.min(Math.log10(1 + (s.npmDownloads || s.downloads || 0)) * 2, 12);

        const byCategory = new Map();
        for (const s of serversData) {
          const cat = s.category || 'other';
          if (!byCategory.has(cat)) byCategory.set(cat, []);
          byCategory.get(cat).push(s);
        }
        for (const list of byCategory.values()) {
          list.sort((a, b) => engagement(b) - engagement(a));
        }

        const topSeeds = [...serversData].sort((a, b) => engagement(b) - engagement(a)).slice(0, 80);
        const compareSeen = new Set();
        let compareCount = 0;

        for (const seed of topSeeds) {
          const peers = (byCategory.get(seed.category) || [])
            .filter((p) => p.id !== seed.id)
            .slice(0, 3);

          for (const peer of peers) {
            const [a, b] = seed.id < peer.id ? [seed.id, peer.id] : [peer.id, seed.id];
            const key = `${a}|${b}`;
            if (compareSeen.has(key)) continue;
            compareSeen.add(key);
            add(secondary, `${BASE_URL}/mcp/${a}/vs/${b}`);
            compareCount++;
            if (compareCount >= 400) break;
          }
          if (compareCount >= 400) break;
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
