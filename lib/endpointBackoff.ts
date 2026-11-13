/**
 * Backoff for the health cron's remote-endpoint handshake.
 *
 * The cron used to handshake every hosted endpoint on every pass, whether it
 * had answered in months or had told us to stop. Republeq's endpoint (Nov
 * 2026) answered "0 further unauthorized attempts remain before an automatic
 * ban" and we kept knocking. Two rules now:
 *
 * - Down (timeouts, refused connections, DNS failures, 5xx, anything not
 *   MCP): consecutive failures space the next handshake out along
 *   DOWN_BACKOFF_DAYS, so a server dead for a week is tried weekly, then
 *   fortnightly, then monthly.
 * - Blocked (403, 429, or a body about bans, rate limits or remaining
 *   attempts): stop at once for BLOCKED_PAUSE_DAYS.
 *
 * Retry-After is honoured for both, capped at MAX_RETRY_AFTER_DAYS. One
 * success clears everything, and so does a new endpoint URL (an owner edit or
 * a fresh discovery), because the state is keyed on the URL it was earned by.
 * An admin "Check health" clears it and probes at once.
 *
 * A 401 with an OAuth challenge is not a failure: callMcpEndpoint reports it
 * as ok + authRequired, the healthy answer of an auth-gated server.
 */

/** Identifies our probes so an operator can recognise and allowlist them. */
export const HEALTH_CHECK_USER_AGENT =
  'AllMCPs-HealthCheck/1.0 (+https://allmcps.com/contact)';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days until the next handshake after the 1st, 2nd, 3rd... consecutive failure. */
export const DOWN_BACKOFF_DAYS = [1, 2, 4, 7, 14, 30] as const;
/** Days without a handshake after an endpoint signals it blocked us. */
export const BLOCKED_PAUSE_DAYS = 30;
/** Longest Retry-After we honour, so a typo'd header can't park a listing forever. */
const MAX_RETRY_AFTER_DAYS = 90;
/** Stored block reasons are a short excerpt for the admin view. */
const REASON_MAX = 300;

const BLOCK_TEXT =
  /\bban(?:ned)?\b|\bblock(?:ed|list(?:ed)?)?\b|unauthori[sz]ed attempts?|attempts? remain|rate[- ]?limit|too many requests|throttl/i;

/** What one handshake told us. Mirrors the relevant McpResult fields. */
export type EndpointProbeOutcome = {
  ok: boolean;
  authRequired?: boolean;
  error?: string;
  httpStatus?: number;
  retryAfterSeconds?: number;
};

/** The backoff columns of listing_signals. */
export type EndpointBackoffState = {
  endpointFailures: number;
  endpointRetryAt: Date | null;
  endpointBlockedReason: string | null;
  endpointBackoffUrl: string | null;
};

export const CLEARED_BACKOFF: EndpointBackoffState = {
  endpointFailures: 0,
  endpointRetryAt: null,
  endpointBlockedReason: null,
  endpointBackoffUrl: null,
};

/** Retry-After as seconds from `now` (delta-seconds or HTTP-date), or undefined. */
export function parseRetryAfter(
  header: string | null | undefined,
  now: Date = new Date(),
): number | undefined {
  const value = header?.trim();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const at = Date.parse(value);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.round((at - now.getTime()) / 1000));
}

/** True when the endpoint is telling us to go away, not that it is broken. */
export function isBlockSignal(outcome: EndpointProbeOutcome): boolean {
  if (outcome.ok) return false;
  if (outcome.httpStatus === 403 || outcome.httpStatus === 429) return true;
  return BLOCK_TEXT.test(outcome.error ?? '');
}

function retryAfterMs(outcome: EndpointProbeOutcome): number {
  const s = outcome.retryAfterSeconds;
  if (s == null || !Number.isFinite(s) || s <= 0) return 0;
  return Math.min(s * 1000, MAX_RETRY_AFTER_DAYS * DAY_MS);
}

/** Stored state applies only to the URL that earned it. */
function stateFor(
  prev: EndpointBackoffState | null | undefined,
  url: string,
): EndpointBackoffState {
  if (!prev || prev.endpointBackoffUrl !== url) return CLEARED_BACKOFF;
  return prev;
}

/** Whether the cron may handshake `url` now, or should leave it alone this pass. */
export function shouldProbeEndpoint(
  prev: EndpointBackoffState | null | undefined,
  url: string,
  now: Date,
): boolean {
  const state = stateFor(prev, url);
  return !state.endpointRetryAt || state.endpointRetryAt <= now;
}

/** The state after a handshake of `url` produced `outcome`. */
export function nextBackoffState(
  prev: EndpointBackoffState | null | undefined,
  url: string,
  outcome: EndpointProbeOutcome,
  now: Date,
): EndpointBackoffState {
  if (outcome.ok) return CLEARED_BACKOFF;
  const failures = stateFor(prev, url).endpointFailures + 1;
  const blocked = isBlockSignal(outcome);
  const days = blocked
    ? BLOCKED_PAUSE_DAYS
    : DOWN_BACKOFF_DAYS[Math.min(failures, DOWN_BACKOFF_DAYS.length) - 1];
  const waitMs = Math.max(days * DAY_MS, retryAfterMs(outcome));
  return {
    endpointFailures: failures,
    endpointRetryAt: new Date(now.getTime() + waitMs),
    endpointBlockedReason: blocked
      ? (
          outcome.error?.trim() || `HTTP ${outcome.httpStatus ?? 'error'}`
        ).slice(0, REASON_MAX)
      : null,
    endpointBackoffUrl: url,
  };
}

/** Whether two states differ in anything stored (avoids no-op writes). */
export function backoffChanged(
  prev: EndpointBackoffState | null | undefined,
  next: EndpointBackoffState,
): boolean {
  const p = prev ?? CLEARED_BACKOFF;
  return (
    p.endpointFailures !== next.endpointFailures ||
    (p.endpointRetryAt?.getTime() ?? null) !==
      (next.endpointRetryAt?.getTime() ?? null) ||
    p.endpointBlockedReason !== next.endpointBlockedReason ||
    p.endpointBackoffUrl !== next.endpointBackoffUrl
  );
}

/** One line for the admin view, or null when the endpoint is on the normal cadence. */
export function backoffSummary(
  state: {
    endpointFailures?: number | null;
    endpointRetryAt?: Date | string | number | null;
    endpointBlockedReason?: string | null;
  },
  now: Date = new Date(),
): string | null {
  const failures = state.endpointFailures ?? 0;
  if (failures <= 0 || state.endpointRetryAt == null) return null;
  const retryAt = new Date(state.endpointRetryAt);
  if (Number.isNaN(retryAt.getTime())) return null;
  const when =
    retryAt <= now
      ? 'due on the next pass'
      : `next try ${retryAt.toISOString().slice(0, 10)}`;
  return state.endpointBlockedReason
    ? `Endpoint blocked our check, paused (${when}): ${state.endpointBlockedReason}`
    : `Endpoint failed ${failures}x in a row, backing off (${when})`;
}
