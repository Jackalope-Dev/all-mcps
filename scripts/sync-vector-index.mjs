/**
 * Backfill vector embeddings onto listings never indexed into Cloudflare
 * Vectorize (see /api/cron/vector-index and db column vector_synced_at).
 *
 * Usage:
 *   ALLMCPS_ADMIN_SECRET=xxx node scripts/sync-vector-index.mjs
 *   ALLMCPS_ADMIN_SECRET=xxx ALLMCPS_BASE_URL=https://allmcps.com node scripts/sync-vector-index.mjs
 *
 * Safe to stop and re-run — it always picks up where it left off (rows already
 * indexed are excluded by the route's own query). The route claims a bounded
 * batch per call (see BATCH_SIZE in the route), so this loops until drained
 * rather than expecting one call to cover the whole catalog.
 */

const BASE_URL = process.env.ALLMCPS_BASE_URL || 'https://allmcps.com';
const SECRET = process.env.ALLMCPS_ADMIN_SECRET || process.env.ADMIN_SECRET;
const ENDPOINT = `${BASE_URL}/api/cron/vector-index`;
const DELAY_MS = Number(process.env.ALLMCPS_BACKFILL_DELAY_MS || 1500);
const MAX_IDLE_CALLS = 3;

if (!SECRET) {
  console.error('Missing ALLMCPS_ADMIN_SECRET (or ADMIN_SECRET) environment variable.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let totalIndexed = 0;
  let idleCalls = 0;
  let call = 0;

  console.log(`Backfilling vector index via ${ENDPOINT}\n`);

  while (true) {
    call++;
    let data;
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET}` },
      });
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        console.error(`Call ${call}: non-JSON response (${res.status}): ${text.slice(0, 200)}`);
        break;
      }
      if (!res.ok || data.status !== 'ok') {
        console.error(`Call ${call}: error response (${res.status}):`, data);
        break;
      }
    } catch (err) {
      console.error(`Call ${call}: request failed:`, err.message);
      break;
    }

    totalIndexed += data.indexed || 0;
    console.log(
      `Call ${call}: +${data.indexed} indexed, ${data.failed} failed | ~${data.remaining} remaining | ${totalIndexed} total`
    );

    if ((data.indexed || 0) === 0 && (data.claimed || 0) === 0) {
      idleCalls++;
      if (idleCalls >= MAX_IDLE_CALLS) {
        console.log('\nNo progress across several calls — stopping.');
        break;
      }
    } else {
      idleCalls = 0;
    }

    if (data.remaining === 0) {
      console.log('\n✓ Vector index backfill complete.');
      break;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${totalIndexed} listings indexed this run.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
