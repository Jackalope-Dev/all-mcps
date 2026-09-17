/**
 * E2B sandbox verification: verifies stdio MCP listings by actually installing and
 * running them, instead of trusting README-parsed tool guesses.
 *
 * Why this runs here and not in a Worker cron: E2B's SDK doesn't work inside
 * the Cloudflare Workers runtime (transport layer incompatibility — confirmed
 * against their own docs), so the sandbox orchestration has to run on a real
 * Node.js process. This script is that process, meant to run from the
 * `e2b-stdio-verify` GitHub Actions workflow (manual dispatch, same shape as
 * scripts/backfill-ai-content.mjs).
 *
 * For each listing in a batch: spin up a fresh sandbox, run the cached
 * install command, speak the MCP stdio protocol (initialize -> tools/list)
 * over its stdin/stdout with a hard per-listing timeout, then tear the
 * sandbox down. Results are POSTed to /api/cron/stdio-verify/result, which
 * records every outcome in stdio_verifications and promotes an 'ok' result's
 * tools into servers.tools/tools_source — a sandbox that completed a real
 * initialize/tools‑list handshake is as authoritative as a live HTTP one.
 * Failures feed the guessed-install cleanup described in that route.
 *
 * Runs a concurrency pool (default 15, capped below E2B Hobby's 20-concurrent-
 * sandbox limit) that keeps pulling pages from /api/cron/stdio-verify/batch and
 * draining them until either the catalog is exhausted or RUN_BUDGET_MS is hit
 * — so one dispatch can walk through most/all of the stdio backlog instead of
 * a single fixed-size batch.
 *
 * Usage:
 *   E2B_API_KEY=xxx ALLMCPS_CRON_SECRET=xxx node scripts/e2b-stdio-verify.mjs
 *   E2B_API_KEY=xxx ALLMCPS_CRON_SECRET=xxx CONCURRENCY=15 RUN_BUDGET_MS=18000000 node scripts/e2b-stdio-verify.mjs
 *
 * Safe to re-run/interrupt — each fetched page only returns listings not yet
 * in the verifier table, so progress is never lost or reprocessed.
 */

import { Sandbox } from 'e2b';

const BASE_URL = process.env.ALLMCPS_BASE_URL || 'https://allmcps.com';
const SECRET =
  process.env.ALLMCPS_CRON_SECRET ||
  process.env.CRON_SECRET ||
  process.env.ALLMCPS_ADMIN_SECRET ||
  process.env.ADMIN_SECRET;
const E2B_API_KEY = process.env.E2B_API_KEY;
// Page size per /batch call — kept well above CONCURRENCY so workers rarely
// wait on a refetch. Capped at 100 by the endpoint itself.
const BATCH_SIZE = Number.parseInt(process.env.BATCH_SIZE || '100', 10);
// How many sandboxes run at once. E2B Hobby (free) tier caps concurrent
// sandboxes at 20 — default sits a few below that as headroom for teardown
// lag rather than running flush against the limit.
const CONCURRENCY = Number.parseInt(process.env.CONCURRENCY || '15', 10);
// Wall-clock budget for the whole run — stop starting new listings once hit,
// let in-flight ones finish, then exit cleanly (well under the GH Actions job
// timeout). Minutes, not ms, since GitHub Actions expression syntax doesn't
// reliably support arithmetic — the workflow passes raw minutes and the
// multiplication happens here instead. Default 5h.
const RUN_BUDGET_MS = process.env.RUN_BUDGET_MS
  ? Number.parseInt(process.env.RUN_BUDGET_MS, 10)
  : Number.parseInt(process.env.RUN_BUDGET_MINUTES || '300', 10) * 60_000;

// Per-listing hard cap: bounds worst-case sandbox time/cost from a hung or
// oversized install (see the cost discussion this check came out of — a
// single runaway install shouldn't blow the run's budget). Widened from an
// initial 45s after the first real batch showed timeouts that were plausibly
// just slow/uncached npx installs, not genuinely broken servers — a listing
// can burn up to ~2x this (initialize wait + tools/list wait) worst case.
const HANDSHAKE_TIMEOUT_MS = 90_000;
const SANDBOX_BOOT_TIMEOUT_MS = 90_000;

const INSTALL_FAILURE_MARKERS = [
  'npm ERR!',
  'command not found',
  'No matching distribution found',
  'ERROR: Could not find',
  'ModuleNotFoundError',
];

if (!SECRET) {
  console.error('Missing ALLMCPS_ADMIN_SECRET (or ADMIN_SECRET).');
  process.exit(1);
}
if (!E2B_API_KEY) {
  console.error('Missing E2B_API_KEY.');
  process.exit(1);
}

async function fetchBatchOnce() {
  const res = await fetch(
    `${BASE_URL}/api/cron/stdio-verify/batch?batch_size=${BATCH_SIZE}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}` },
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>');
    throw new Error(
      `batch fetch failed: HTTP ${res.status} - ${body.slice(0, 500)}`,
    );
  }
  return res.json();
}

/** A transient batch-fetch failure shouldn't kill the whole run — retry with backoff. */
async function fetchBatch() {
  const RETRIES = 3;
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const data = await fetchBatchOnce();
      return data.batch || [];
    } catch (e) {
      lastErr = e;
      console.error(
        `  ! batch fetch attempt ${attempt}/${RETRIES} failed: ${e.message}`,
      );
      if (attempt < RETRIES)
        await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  throw lastErr;
}

async function postResult(result) {
  const res = await fetch(`${BASE_URL}/api/cron/stdio-verify/result`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(result),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>');
    console.error(
      `  ! failed to record result for ${result.serverId}: HTTP ${res.status} - ${body.slice(0, 500)}`,
    );
  }
}

/** Reads newline-delimited JSON-RPC frames out of an accumulating stdout buffer. */
function makeJsonRpcReader() {
  let buffer = '';
  const waiters = [];

  function feed(chunk) {
    buffer += chunk;
    let idx = buffer.indexOf('\n');
    while (idx >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      idx = buffer.indexOf('\n');
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // Not a JSON-RPC line — some servers log to stdout too.
      }
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].id === msg.id) {
          waiters[i].resolve(msg);
          waiters.splice(i, 1);
        }
      }
    }
  }

  function waitFor(id, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = waiters.findIndex((w) => w.id === id);
        if (i >= 0) waiters.splice(i, 1);
        reject(new Error('timeout'));
      }, timeoutMs);
      waiters.push({
        id,
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });
    });
  }

  return { feed, waitFor };
}

/**
 * The E2B base sandbox has npx/node but not uv/uvx — confirmed in practice:
 * 23 of 34 install_failed results in one clean verification batch were the exact
 * same "uvx: command not found", not 23 different broken listings. Bootstrap
 * it inline (idempotent, cheap if already present) rather than requiring a
 * custom E2B template.
 */
function withRunnerBootstrap(command, cmd) {
  if (command !== 'uvx') return cmd;
  return (
    '(command -v uvx >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1); ' +
    `export PATH="$HOME/.local/bin:$PATH"; ${cmd}`
  );
}

async function verifyListing(listing) {
  const started = Date.now();
  const cmd = withRunnerBootstrap(
    listing.installCommand,
    [listing.installCommand, ...listing.installArgs].join(' '),
  );
  let sbx;
  let stderrBuf = '';
  const reader = makeJsonRpcReader();

  try {
    sbx = await Sandbox.create({
      apiKey: E2B_API_KEY,
      timeoutMs: SANDBOX_BOOT_TIMEOUT_MS,
    });

    const proc = await sbx.commands.run(cmd, {
      background: true,
      stdin: true,
      onStdout: (data) => reader.feed(data),
      onStderr: (data) => {
        stderrBuf += data;
      },
    });

    // Give the process a moment to boot before writing to its stdin.
    await new Promise((r) => setTimeout(r, 1500));

    let initMsg;
    try {
      // sendStdin itself can throw here — a process that crashed on a bad
      // install/package before we got to write (confirmed in practice: this
      // was landing in the outer catch as an opaque "pid not found" error,
      // discarding the real stderr sitting right there in stderrBuf) needs
      // the same install-failure classification as a wait-for-initialize
      // timeout, not a generic 'error'.
      await sbx.commands.sendStdin(
        proc.pid,
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'AllMCPs E2B Verification', version: '1.0.0' },
          },
        })}\n`,
      );
      initMsg = await reader.waitFor(1, HANDSHAKE_TIMEOUT_MS);
    } catch (e) {
      const looksLikeInstallFailure =
        INSTALL_FAILURE_MARKERS.some((m) => stderrBuf.includes(m)) ||
        /pid \d+ not found/.test(e?.message || '');
      return {
        serverId: listing.id,
        status: looksLikeInstallFailure ? 'install_failed' : 'timeout',
        error: (looksLikeInstallFailure
          ? stderrBuf || e?.message || 'Install failed.'
          : 'No response to initialize.'
        ).slice(0, 500),
        durationMs: Date.now() - started,
      };
    }
    if (initMsg.error) {
      return {
        serverId: listing.id,
        status: 'handshake_failed',
        error: (initMsg.error.message || 'initialize failed').slice(0, 500),
        durationMs: Date.now() - started,
      };
    }

    let toolsMsg;
    try {
      await sbx.commands.sendStdin(
        proc.pid,
        `${JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        })}\n`,
      );
      await sbx.commands.sendStdin(
        proc.pid,
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        })}\n`,
      );
      toolsMsg = await reader.waitFor(2, HANDSHAKE_TIMEOUT_MS);
    } catch (e) {
      return {
        serverId: listing.id,
        status: 'handshake_failed',
        error: (/pid \d+ not found/.test(e?.message || '')
          ? `Process exited after initialize, before tools/list: ${stderrBuf || e.message}`
          : 'initialize succeeded but no response to tools/list.'
        ).slice(0, 500),
        durationMs: Date.now() - started,
      };
    }
    if (toolsMsg.error || !Array.isArray(toolsMsg.result?.tools)) {
      return {
        serverId: listing.id,
        status: 'handshake_failed',
        error: (
          toolsMsg.error?.message || 'tools/list returned no tools array.'
        ).slice(0, 500),
        durationMs: Date.now() - started,
      };
    }

    const tools = toolsMsg.result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    }));

    return {
      serverId: listing.id,
      status: 'ok',
      tools,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      serverId: listing.id,
      status: 'error',
      error: (e?.message || 'Unknown sandbox error').slice(0, 500),
      durationMs: Date.now() - started,
    };
  } finally {
    if (sbx) {
      try {
        await sbx.kill();
      } catch {
        /* best-effort cleanup */
      }
    }
  }
}

/**
 * Shared work queue drained by a fixed-size worker pool. Refills are guarded
 * by a single in-flight promise so concurrent workers hitting an empty queue
 * at once don't fire duplicate /batch calls.
 */
function makeWorkQueue() {
  const queue = [];
  let noMoreWork = false;
  let refillPromise = null;

  async function refill() {
    if (noMoreWork) return;
    if (!refillPromise) {
      refillPromise = fetchBatch()
        .then((page) => {
          if (page.length === 0) noMoreWork = true;
          else queue.push(...page);
        })
        .finally(() => {
          refillPromise = null;
        });
    }
    return refillPromise;
  }

  async function next() {
    if (queue.length === 0 && !noMoreWork) await refill();
    return queue.shift() || null;
  }

  return { next };
}

async function main() {
  const startedAt = Date.now();
  const counts = {};
  let totalProcessed = 0;
  const work = makeWorkQueue();

  console.log(
    `Draining stdio backlog: concurrency=${CONCURRENCY}, page size=${BATCH_SIZE}, budget=${(RUN_BUDGET_MS / 60000).toFixed(0)}min`,
  );

  async function worker() {
    while (Date.now() - startedAt < RUN_BUDGET_MS) {
      let listing;
      try {
        listing = await work.next();
      } catch (e) {
        // fetchBatch() exhausted its retries. Stop this worker quietly rather
        // than throwing through Promise.all — that would abort the whole run
        // (and process.exit() in main's catch would kill other workers'
        // still-in-flight listings before they can post their results).
        console.error(
          `  ! worker stopping — could not fetch more work: ${e.message}`,
        );
        return;
      }
      if (!listing) return; // Backlog exhausted.

      const result = await verifyListing(listing);
      counts[result.status] = (counts[result.status] || 0) + 1;
      totalProcessed++;
      console.log(
        `[${totalProcessed}] ${listing.id} -> ${result.status} (${result.durationMs}ms)${result.tools ? `, ${result.tools.length} tools` : ''}`,
      );
      await postResult(result);

      if (totalProcessed % 25 === 0) {
        const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
        console.log(
          `  -- progress: ${totalProcessed} processed in ${elapsedMin}min | ${JSON.stringify(counts)}`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(
    `\nDone. Processed ${totalProcessed} in ${elapsedMin}min.`,
    counts,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
