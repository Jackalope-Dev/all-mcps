/**
 * Backfill the AI content layer across the whole catalog.
 *
 * The /api/cron/ai-content endpoint enriches a small batch per call (keeping each Worker
 * invocation inside its budget). The scheduled cron only fires every 4h, so draining the
 * initial ~3k-listing backlog that way would take weeks. This script just calls the same
 * endpoint in a loop until `remaining` hits zero — throughput is then bound by the LLM /
 * GitHub, not the cron cadence.
 *
 * Usage:
 *   ALLMCPS_ADMIN_SECRET=xxx node scripts/backfill-ai-content.mjs
 *   ALLMCPS_ADMIN_SECRET=xxx ALLMCPS_BASE_URL=https://allmcps.com node scripts/backfill-ai-content.mjs
 *
 * Safe to stop and re-run — it always picks up where it left off (enriched rows are skipped).
 */

const BASE_URL = process.env.ALLMCPS_BASE_URL || 'https://allmcps.com';
const SECRET = process.env.ALLMCPS_ADMIN_SECRET || process.env.ADMIN_SECRET;
const ENDPOINT = `${BASE_URL}/api/cron/ai-content`;
// Pause between calls so we never hammer the LLM/GitHub or trip rate limits.
const DELAY_MS = Number(process.env.ALLMCPS_BACKFILL_DELAY_MS || 1500);
// Stop after this many calls that enriched nothing (outage/budget wall or truly done).
const MAX_IDLE_CALLS = 3;

if (!SECRET) {
  console.error('Missing ALLMCPS_ADMIN_SECRET (or ADMIN_SECRET) env var.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let totalEnriched = 0;
  let idleCalls = 0;
  let call = 0;

  console.log(`Backfilling AI content via ${ENDPOINT}\n`);

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
      if (!res.ok || !data.success) {
        console.error(`Call ${call}: error response (${res.status}):`, data);
        break;
      }
    } catch (err) {
      console.error(`Call ${call}: request failed:`, err.message);
      break;
    }

    totalEnriched += data.enriched || 0;
    console.log(
      `Call ${call}: +${data.enriched} enriched, ${data.skippedThin} thin-skipped, ` +
        `${data.failed} failed | ~${data.remaining} remaining | ${totalEnriched} total`
    );

    if (data.budgetStopped) {
      console.warn('\nEndpoint stopped early (likely LLM budget/outage). Pausing before retry.');
      await sleep(DELAY_MS * 10);
    }

    if ((data.enriched || 0) === 0 && (data.skippedThin || 0) === 0) {
      idleCalls++;
      if (idleCalls >= MAX_IDLE_CALLS) {
        console.log('\nNo progress across several calls — stopping.');
        break;
      }
    } else {
      idleCalls = 0;
    }

    if (data.remaining === 0) {
      console.log('\n✓ Catalog fully enriched.');
      break;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${totalEnriched} listings enriched this run.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
