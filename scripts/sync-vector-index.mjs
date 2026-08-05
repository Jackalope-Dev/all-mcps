/**
 * Helper script to trigger vector index sync on Cloudflare Vectorize.
 *
 * Usage:
 *   ALLMCPS_ADMIN_SECRET=xxx node scripts/sync-vector-index.mjs
 *   ALLMCPS_ADMIN_SECRET=xxx ALLMCPS_BASE_URL=https://allmcps.com node scripts/sync-vector-index.mjs
 */

const BASE_URL = process.env.ALLMCPS_BASE_URL || 'https://allmcps.com';
const SECRET = process.env.ALLMCPS_ADMIN_SECRET || process.env.ADMIN_SECRET;
const ENDPOINT = `${BASE_URL}/api/cron/vector-index`;

if (!SECRET) {
  console.error('Missing ALLMCPS_ADMIN_SECRET (or ADMIN_SECRET) environment variable.');
  process.exit(1);
}

async function main() {
  console.log(`Triggering vector index sync via ${ENDPOINT}...`);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}` },
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`Response (${res.status}): ${text}`);
      process.exit(1);
    }

    if (!res.ok) {
      console.error(`Error (${res.status}):`, data);
      process.exit(1);
    }

    console.log('✓ Vector index sync completed:', data);
  } catch (err) {
    console.error('Failed to trigger vector sync:', err.message);
    process.exit(1);
  }
}

main();
