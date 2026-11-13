import { describe, expect, it } from 'vitest';
import {
  BLOCKED_PAUSE_DAYS,
  backoffChanged,
  backoffSummary,
  CLEARED_BACKOFF,
  DOWN_BACKOFF_DAYS,
  type EndpointBackoffState,
  isBlockSignal,
  nextBackoffState,
  parseRetryAfter,
  shouldProbeEndpoint,
} from './endpointBackoff';

const DAY = 24 * 60 * 60 * 1000;
const URL = 'https://republeq.com/agent/mcp';
const now = new Date('2026-11-13T12:00:00Z');
const REPUBLEQ =
  'Agent identification and administrator verification are required. 0 further unauthorized attempts remain before an automatic ban.';

function daysUntil(state: EndpointBackoffState): number {
  return ((state.endpointRetryAt?.getTime() ?? 0) - now.getTime()) / DAY;
}

function later(days: number): Date {
  return new Date(now.getTime() + days * DAY);
}

describe('isBlockSignal', () => {
  it('treats 403, 429 and ban or rate-limit text as a block', () => {
    expect(isBlockSignal({ ok: false, httpStatus: 403 })).toBe(true);
    expect(isBlockSignal({ ok: false, httpStatus: 429 })).toBe(true);
    expect(isBlockSignal({ ok: false, httpStatus: 401, error: REPUBLEQ })).toBe(
      true,
    );
    expect(isBlockSignal({ ok: false, error: 'Rate limit exceeded' })).toBe(
      true,
    );
    expect(isBlockSignal({ ok: false, error: 'Your IP is blocked' })).toBe(
      true,
    );
  });

  it('treats outages and timeouts as down, not blocked', () => {
    expect(isBlockSignal({ ok: false, error: 'Connection timed out.' })).toBe(
      false,
    );
    expect(
      isBlockSignal({ ok: false, httpStatus: 502, error: 'HTTP 502' }),
    ).toBe(false);
  });

  it('never treats an OAuth challenge as a failure', () => {
    expect(isBlockSignal({ ok: true, authRequired: true })).toBe(false);
    expect(
      nextBackoffState(null, URL, { ok: true, authRequired: true }, now),
    ).toEqual(CLEARED_BACKOFF);
  });
});

describe('nextBackoffState', () => {
  it('spaces a down endpoint out along the schedule, capped at the last step', () => {
    let state: EndpointBackoffState | null = null;
    const waits: number[] = [];
    for (let i = 0; i < DOWN_BACKOFF_DAYS.length + 2; i++) {
      state = nextBackoffState(
        state,
        URL,
        { ok: false, error: 'Connection timed out.' },
        now,
      );
      waits.push(daysUntil(state));
    }
    expect(waits).toEqual([1, 2, 4, 7, 14, 30, 30, 30]);
    expect(state?.endpointBlockedReason).toBeNull();
  });

  it('pauses a blocked endpoint at once and keeps what it said', () => {
    const state = nextBackoffState(
      null,
      URL,
      { ok: false, httpStatus: 401, error: REPUBLEQ },
      now,
    );
    expect(state.endpointFailures).toBe(1);
    expect(daysUntil(state)).toBe(BLOCKED_PAUSE_DAYS);
    expect(state.endpointBlockedReason).toBe(REPUBLEQ);
    expect(shouldProbeEndpoint(state, URL, later(29))).toBe(false);
    expect(shouldProbeEndpoint(state, URL, later(30))).toBe(true);
  });

  it('honours a Retry-After longer than the schedule, up to 90 days', () => {
    const longer = nextBackoffState(
      null,
      URL,
      { ok: false, httpStatus: 503, retryAfterSeconds: 5 * 86400 },
      now,
    );
    expect(daysUntil(longer)).toBe(5);
    const absurd = nextBackoffState(
      null,
      URL,
      { ok: false, httpStatus: 429, retryAfterSeconds: 10_000 * 86400 },
      now,
    );
    expect(daysUntil(absurd)).toBe(90);
  });

  it('resets on one success', () => {
    const failed = nextBackoffState(null, URL, { ok: false }, now);
    expect(nextBackoffState(failed, URL, { ok: true }, now)).toEqual(
      CLEARED_BACKOFF,
    );
  });

  it('starts fresh when the endpoint URL changes', () => {
    const blocked = nextBackoffState(
      null,
      URL,
      { ok: false, httpStatus: 403 },
      now,
    );
    const moved = 'https://republeq.com/mcp/v2';
    expect(shouldProbeEndpoint(blocked, moved, now)).toBe(true);
    const next = nextBackoffState(blocked, moved, { ok: false }, now);
    expect(next.endpointFailures).toBe(1);
    expect(daysUntil(next)).toBe(1);
  });
});

describe('parseRetryAfter', () => {
  it('reads delta-seconds and HTTP dates', () => {
    expect(parseRetryAfter('120', now)).toBe(120);
    expect(parseRetryAfter('Fri, 13 Nov 2026 13:00:00 GMT', now)).toBe(3600);
    expect(parseRetryAfter('soon', now)).toBeUndefined();
    expect(parseRetryAfter(null, now)).toBeUndefined();
  });
});

describe('backoffSummary and backoffChanged', () => {
  it('summarises paused and backing-off endpoints for admins', () => {
    const blocked = nextBackoffState(
      null,
      URL,
      { ok: false, error: REPUBLEQ },
      now,
    );
    expect(backoffSummary(blocked, now)).toMatch(
      /^Endpoint blocked our check, paused \(next try 2026-12-13\)/,
    );
    const down = nextBackoffState(null, URL, { ok: false }, now);
    expect(backoffSummary(down, now)).toBe(
      'Endpoint failed 1x in a row, backing off (next try 2026-11-14)',
    );
    expect(backoffSummary(CLEARED_BACKOFF, now)).toBeNull();
  });

  it('skips writes when nothing changed', () => {
    expect(backoffChanged(null, CLEARED_BACKOFF)).toBe(false);
    const down = nextBackoffState(null, URL, { ok: false }, now);
    expect(backoffChanged(CLEARED_BACKOFF, down)).toBe(true);
    expect(backoffChanged(down, { ...down })).toBe(false);
  });
});
