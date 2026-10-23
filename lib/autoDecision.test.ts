import { describe, expect, it } from 'vitest';
import {
  decideIngestPromote,
  decideSubmission,
  type GateEvidence,
} from './autoDecision';

const strong: GateEvidence = {
  triageVerdict: 'approve',
  triageConfidence: 0.9,
  mcpProbability: 0.8,
  repoStatus: 'ok',
  repoGoneConfirmed: false,
  stars: 12,
  reviewFlagged: false,
  sandboxStatus: null,
  packageAlive: false,
  liveEndpoint: false,
};

/** A hosted product submitted by its homepage: no repo, stars or package. */
const hosted: GateEvidence = {
  ...strong,
  triageVerdict: 'needs_review',
  mcpProbability: 0.45,
  repoStatus: 'site_only',
  stars: null,
  reviewFlagged: true,
  liveEndpoint: true,
};

describe('decideSubmission', () => {
  it('approves only when every bar is met', () => {
    expect(decideSubmission(strong)?.decision).toBe('approve');
  });

  it('waits for triage and a repo check before deciding', () => {
    expect(decideSubmission({ ...strong, triageVerdict: null })).toBeNull();
    expect(decideSubmission({ ...strong, repoStatus: null })).toBeNull();
  });

  it.each([
    ['a Jev reject', { triageVerdict: 'reject' }],
    ['a low MCP probability', { mcpProbability: 0.5 }],
    ['a private repo', { repoStatus: 'site_only' as const }],
    ['an intake flag', { reviewFlagged: true }],
    ['no sign of real use', { stars: 2 }],
  ])('holds on %s', (_label, patch) => {
    const r = decideSubmission({ ...strong, ...patch });
    expect(r?.decision).toBe('hold');
    expect(r?.reasons.length).toBeGreaterThan(0);
  });

  it("approves on Jev's look-closer verdict when the other evidence is strong", () => {
    // Jev's 3-level rubric lands an unsure answer on needs_review at low
    // confidence, so it is a veto (reject) only.
    expect(
      decideSubmission({
        ...strong,
        triageVerdict: 'needs_review',
        triageConfidence: 0.35,
      })?.decision,
    ).toBe('approve');
  });

  it('accepts a sandbox run or a published package as proof instead of stars', () => {
    expect(
      decideSubmission({ ...strong, stars: 0, sandboxStatus: 'ok' })?.decision,
    ).toBe('approve');
    expect(
      decideSubmission({ ...strong, stars: 0, packageAlive: true })?.decision,
    ).toBe('approve');
  });

  it('rejects a confirmed-dead source even before triage', () => {
    expect(
      decideSubmission({
        ...strong,
        triageVerdict: null,
        repoGoneConfirmed: true,
      })?.decision,
    ).toBe('reject');
  });

  it('approves a hosted product on its live endpoint', () => {
    const r = decideSubmission(hosted);
    expect(r?.decision).toBe('approve');
    expect(r?.reasons).toContain('hosted endpoint answers MCP');
    expect(decideSubmission({ ...hosted, liveEndpoint: false })?.decision).toBe(
      'hold',
    );
  });

  it("doesn't wait on a repo check for a hosted product with a live endpoint", () => {
    expect(decideSubmission({ ...hosted, repoStatus: null })?.decision).toBe(
      'approve',
    );
    expect(
      decideSubmission({ ...hosted, repoStatus: null, liveEndpoint: false }),
    ).toBeNull();
  });

  it('rejects a Jev reject with no sign of real use', () => {
    expect(
      decideSubmission({ ...strong, triageVerdict: 'reject', stars: 0 })
        ?.decision,
    ).toBe('reject');
  });

  it('never rejects a server seen running', () => {
    expect(
      decideSubmission({ ...hosted, triageVerdict: 'reject' })?.decision,
    ).toBe('hold');
    expect(
      decideSubmission({ ...hosted, repoGoneConfirmed: true })?.decision,
    ).not.toBe('reject');
  });

  it('never rejects on Jev alone', () => {
    expect(
      decideSubmission({
        ...strong,
        triageVerdict: 'reject',
        triageConfidence: 0.99,
      })?.decision,
    ).toBe('hold');
  });
});

describe('decideIngestPromote', () => {
  it('takes a live endpoint as proof for a site-only listing', () => {
    const site = {
      ...strong,
      repoStatus: 'site_only' as const,
      stars: null,
    };
    expect(decideIngestPromote(site)?.decision).toBe('hold');
    expect(decideIngestPromote({ ...site, liveEndpoint: true })?.decision).toBe(
      'approve',
    );
  });

  it("promotes on Jev's look-closer verdict but holds a low MCP probability", () => {
    expect(
      decideIngestPromote({
        ...strong,
        triageVerdict: 'needs_review',
        triageConfidence: 0.4,
      })?.decision,
    ).toBe('approve');
    expect(
      decideIngestPromote({ ...strong, mcpProbability: 0.5 })?.decision,
    ).toBe('hold');
  });

  it('never rejects', () => {
    expect(
      decideIngestPromote({ ...strong, triageVerdict: 'reject' })?.decision,
    ).toBe('hold');
    expect(
      decideIngestPromote({ ...strong, repoGoneConfirmed: true })?.decision,
    ).toBe('hold');
  });

  it('holds anything flagged at import as a possible duplicate', () => {
    const r = decideIngestPromote({ ...strong, reviewFlagged: true });
    expect(r?.decision).toBe('hold');
    expect(r?.reasons.join(' ')).toMatch(/duplicate/);
  });

  it('wants proof beyond stars for a private-repo listing', () => {
    const site = { ...strong, repoStatus: 'site_only' as const, stars: null };
    expect(decideIngestPromote(site)?.decision).toBe('hold');
    expect(decideIngestPromote({ ...site, packageAlive: true })?.decision).toBe(
      'approve',
    );
  });
});
