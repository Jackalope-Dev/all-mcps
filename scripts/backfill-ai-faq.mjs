/**
 * Backfill the FAQ field onto listings that were AI-enriched before FAQ
 * generation existed (see /api/cron/ai-faq and db column ai_faq_at).
 *
 * Usage:
 *   ALLMCPS_ADMIN_SECRET=xxx node scripts/backfill-ai-faq.mjs
 *   ALLMCPS_ADMIN_SECRET=xxx ALLMCPS_BASE_URL=https://allmcps.com node scripts/backfill-ai-faq.mjs
 *
 * Safe to stop and re-run — it always picks up where it left off (rows with a
 * FAQ already, or never-enriched rows, are excluded by the route's own query).
 *
 * Avoid running this concurrently with scripts/backfill-ai-content.mjs: both sort
 * the same backlog by views/upvotes/stars, so they're likely to target the same
 * high-value rows. The route's own 5-minute "settled" buffer on ai_enriched_at
 * guards against actually claiming a row ai-content hasn't finished writing yet,
 * but running them apart avoids the collision (and wasted LLM calls) entirely.
 */

const BASE_URL = process.env.ALLMCPS_BASE_URL || 'https://allmcps.com';
const SECRET = process.env.ALLMCPS_ADMIN_SECRET || process.env.ADMIN_SECRET;
const ENDPOINT = `${BASE_URL}/api/cron/ai-faq`;
const DELAY_MS = Number(process.env.ALLMCPS_BACKFILL_DELAY_MS || 1500);
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

  console.log(`Backfilling AI FAQ via ${ENDPOINT}\n`);

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
      console.log('\n✓ FAQ backfill complete.');
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
