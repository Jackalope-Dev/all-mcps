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

async function collectAllUrls() {
  const urls = new Set();

  // 1. Static Pages
  const staticRoutes = [
    '',
    '/browse',
    '/categories',
    '/best',
    '/clients',
    '/about',
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
  ];

  for (const route of staticRoutes) {
    urls.add(`${BASE_URL}${route}`);
  }

  // 2. Blog Posts
  const blogDir = path.join(rootDir, 'content', 'blog');
  if (fs.existsSync(blogDir)) {
    const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.md'));
    const pattern = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;
    for (const file of files) {
      const match = file.match(pattern);
      if (match) {
        const slug = match[2];
        urls.add(`${BASE_URL}/blog/${slug}`);
      }
    }
  }

  // 3. Category Pages
  const catManifestPath = path.join(rootDir, 'lib', 'category-manifest.json');
  if (fs.existsSync(catManifestPath)) {
    try {
      const categories = JSON.parse(fs.readFileSync(catManifestPath, 'utf8'));
      for (const cat of categories) {
        // Strip emoji and non-alphanumeric except spaces and &
        const clean = String(cat)
          .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s]+/u, '')
          .toLowerCase()
          .replace(/&/g, ' and ')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (clean) {
          urls.add(`${BASE_URL}/categories/${clean}`);
        }
      }
    } catch (e) {
      console.error('Error parsing category-manifest.json:', e.message);
    }
  }

  // 4. MCP Servers, Alternatives, and Top Comparison Pairs
  const serversPath = path.join(rootDir, 'data', 'mcp-servers.json');
  if (fs.existsSync(serversPath)) {
    try {
      const serversData = JSON.parse(fs.readFileSync(serversPath, 'utf8'));
      if (Array.isArray(serversData)) {
        for (const server of serversData) {
          if (server.id) {
            urls.add(`${BASE_URL}/mcp/${server.id}`);
            urls.add(`${BASE_URL}/mcp/${server.id}/alternatives`);
          }
        }

        // Compare pages: top engagement servers x top peers in same category (matching sitemap logic)
        const engagement = (s) => (s.stars || 0) * 2 + (s.downloads || 0);
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
            urls.add(`${BASE_URL}/mcp/${a}/vs/${b}`);
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

  return Array.from(urls);
}

async function submitBatch(urlBatch, batchNumber, totalBatches) {
  const payload = {
    host: 'allmcps.com',
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: urlBatch,
  };

  console.log(`Submitting batch ${batchNumber}/${totalBatches} (${urlBatch.length} URLs)...`);

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 200 || res.status === 202) {
      console.log(`✓ Batch ${batchNumber} successfully submitted to IndexNow (Status ${res.status}).`);
    } else {
      const responseText = await res.text();
      console.error(`✗ Batch ${batchNumber} failed with status ${res.status}: ${responseText}`);
    }
  } catch (err) {
    console.error(`✗ Batch ${batchNumber} network error:`, err.message);
  }
}

async function main() {
  console.log('🚀 Gathering all site URLs for IndexNow submission...');
  const allUrls = await collectAllUrls();
  console.log(`Found ${allUrls.length} total URLs.`);

  const BATCH_SIZE = 10000;
  const totalBatches = Math.ceil(allUrls.length / BATCH_SIZE);

  for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
    const batch = allUrls.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    await submitBatch(batch, batchNum, totalBatches);
  }

  console.log('\n🎉 Finished IndexNow submission process!');
}

main();
