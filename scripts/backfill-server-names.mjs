/**
 * One-off backlog cleanup: replaces bare technical `name` labels ("mcp",
 * "mcp-server", "reference-data", ...) across the catalog with a real title —
 * the repo's README h1, else a humanized repo/owner slug, else a humanized
 * hostname for non-GitHub listings. See lib/listingEnrich.ts#deriveServerName
 * and app/api/cron/fix-names/route.ts for the actual logic; this script just
 * pages the endpoint forward through the catalog until it's fully scanned.
 *
 * Usage:
 *   ALLMCPS_ADMIN_SECRET=xxx node scripts/backfill-server-names.mjs             # dry run, prints proposed renames
 *   ALLMCPS_ADMIN_SECRET=xxx node scripts/backfill-server-names.mjs --apply     # writes the renames
 *   ALLMCPS_ADMIN_SECRET=xxx ALLMCPS_BASE_URL=https://allmcps.com node scripts/backfill-server-names.mjs --apply
 *
 * Safe to stop and re-run — already-fixed rows no longer match the generic
 * check, so they're skipped on the next pass automatically.
 */

const BASE_URL = process.env.ALLMCPS_BASE_URL || 'https://allmcps.com';
const SECRET = process.env.ALLMCPS_ADMIN_SECRET || process.env.ADMIN_SECRET;
const APPLY = process.argv.includes('--apply');
const DELAY_MS = Number(process.env.ALLMCPS_BACKFILL_DELAY_MS || 800);

if (!SECRET) {
  console.error('Missing ALLMCPS_ADMIN_SECRET (or ADMIN_SECRET) env var.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let after = '';
  let call = 0;
  let totalScanned = 0;
  let totalGeneric = 0;
  let totalFixed = 0;
  const allResults = [];

  console.log(
    `${APPLY ? 'APPLYING' : 'DRY RUN'} — backfilling server names via ${BASE_URL}/api/cron/fix-names\n`,
  );

  while (true) {
    call++;
    const url = new URL('/api/cron/fix-names', BASE_URL);
    url.searchParams.set('after', after);
    if (!APPLY) url.searchParams.set('dryRun', '1');

    let data;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRET}` },
      });
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        console.error(
          `Call ${call}: non-JSON response (${res.status}): ${text.slice(0, 200)}`,
        );
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

    totalScanned += data.scanned || 0;
    totalGeneric += data.genericFound || 0;
    totalFixed += data.fixed || data.proposed || 0;
    for (const r of data.results || []) {
      allResults.push(r);
      console.log(`  ${r.id}: "${r.oldName}" -> "${r.newName}"`);
    }

    console.log(
      `Call ${call}: scanned ${data.scanned}, ${data.genericFound} generic, ` +
        `${data.fixed || data.proposed || 0} ${APPLY ? 'fixed' : 'proposed'} | cursor now ${data.nextCursor}`,
    );

    if (data.ghErrors > 0) {
      console.warn(
        '  (hit GitHub rate limit this page — pausing before retry)',
      );
      await sleep(DELAY_MS * 10);
      continue; // retry same page (cursor only advances past fully-scanned pages)
    }

    after = data.nextCursor;
    if (data.done) {
      console.log('\n✓ Reached the end of the active catalog.');
      break;
    }

    await sleep(DELAY_MS);
  }

  console.log(
    `\nDone. ${totalScanned} scanned, ${totalGeneric} generic names found, ${totalFixed} ${APPLY ? 'renamed' : 'would be renamed'}.`,
  );
  if (!APPLY) {
    console.log(
      'This was a dry run — re-run with --apply to write these changes.',
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
