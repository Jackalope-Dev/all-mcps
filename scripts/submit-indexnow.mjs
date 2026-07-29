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
    '/about',
    '/blog',
    '/contact',
    '/submit',
    '/terms',
    '/privacy',
    '/what-is-mcp',
    '/guide',
    '/build-mcp-server',
    '/pricing',
    '/tools',
    '/tools/config-generator',
    '/tools/config-validator',
    '/tools/token-calculator',
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

  // 3. MCP Servers
  const serversPath = path.join(rootDir, 'data', 'mcp-servers.json');
  if (fs.existsSync(serversPath)) {
    try {
      const serversData = JSON.parse(fs.readFileSync(serversPath, 'utf8'));
      if (Array.isArray(serversData)) {
        for (const server of serversData) {
          if (server.id) {
            urls.add(`${BASE_URL}/mcp/${server.id}`);
          }
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
