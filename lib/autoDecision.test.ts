import { describe, expect, it } from 'vitest';
import {
  decideIngestPromote,
  decideSubmission,
  decideSubmissionFromStored,
  type GateEvidence,
  NO_USAGE_YET,
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
  policyFlags: [],
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

  it('holds adult content for a human however strong the evidence', () => {
    const adult: GateEvidence = {
      ...strong,
      policyFlags: ['adult'],
      liveEndpoint: true,
    };
    expect(decideSubmission(adult)?.decision).toBe('hold');
    expect(decideIngestPromote(adult)?.decision).toBe('hold');
    // Even before triage has run.
    expect(decideSubmission({ ...adult, triageVerdict: null })?.decision).toBe(
      'hold',
    );
  });

  it('waits for triage and a repo check before deciding', () => {
    expect(decideSubmission({ ...strong, triageVerdict: null })).toBeNull();
    expect(decideSubmission({ ...strong, repoStatus: null })).toBeNull();
  });

  it.each([
    ['a Jev reject', { triageVerdict: 'reject' }],
    ['a low MCP probability', { mcpProbability: 0.5 }],
    ['a private repo', { repoStatus: 'site_only' as const }],
    [
      'an intake flag Jev did not overrule',
      { reviewFlagged: true, triageVerdict: 'needs_review' },
    ],
  ])('holds on %s', (_label, patch) => {
    const r = decideSubmission({ ...strong, ...patch });
    expect(r?.decision).toBe('hold');
    expect(r?.reasons.length).toBeGreaterThan(0);
  });

  it('does not hold a Jev-approved server for low usage', () => {
    // Admin policy 2026-11-05: discovery of new servers is part of the point,
    // and the trust tier tells users how proven a listing is.
    const r = decideSubmission({ ...strong, stars: 0 });
    expect(r?.decision).toBe('approve');
    expect(r?.reasons).toContain(NO_USAGE_YET);
  });

  it('holds when Jev is unsure and nothing shows the server runs', () => {
    const r = decideSubmission({
      ...strong,
      stars: 0,
      triageVerdict: 'needs_review',
    });
    expect(r?.decision).toBe('hold');
    expect(r?.reasons).toContain('Jev is unsure and nothing shows it runs');
  });

  it('holds a listing the admin rejected before, however strong', () => {
    const r = decideSubmission({
      ...strong,
      liveEndpoint: true,
      priorRejection: true,
    });
    expect(r?.decision).toBe('hold');
    expect(r?.reasons[0]).toMatch(/rejected this listing before/);
  });

  it('holds a batch of submissions from one submitter', () => {
    // A templated network (13 near-identical listings at once) looks like a
    // real new server on every other signal.
    const r = decideSubmission({ ...strong, sameSubmitterPending: 13 });
    expect(r?.decision).toBe('hold');
    expect(r?.reasons[0]).toMatch(/13 submissions pending/);
    expect(
      decideSubmission({ ...strong, sameSubmitterPending: 2 })?.decision,
    ).toBe('approve');
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

  it('approves a hosted product on its live endpoint when Jev approves', () => {
    const r = decideSubmission({ ...hosted, triageVerdict: 'approve' });
    expect(r?.decision).toBe('approve');
    expect(r?.reasons).toContain('hosted endpoint answers MCP');
    expect(
      decideSubmission({
        ...hosted,
        triageVerdict: 'approve',
        liveEndpoint: false,
      })?.decision,
    ).toBe('hold');
  });

  it('holds when an open endpoint is the only proof and Jev is unsure', () => {
    const r = decideSubmission(hosted);
    expect(r?.decision).toBe('hold');
    expect(r?.reasons).toContain(
      'endpoint is the only proof and Jev is unsure',
    );
    // Other proof of use lifts the requirement.
    expect(decideSubmission({ ...hosted, packageAlive: true })?.decision).toBe(
      'approve',
    );
  });

  it('lets a later Jev approve replace the intake flag', () => {
    expect(decideSubmission({ ...strong, reviewFlagged: true })?.decision).toBe(
      'approve',
    );
    expect(
      decideSubmission({
        ...strong,
        reviewFlagged: true,
        triageVerdict: 'needs_review',
      })?.decision,
    ).toBe('hold');
  });

  it('holds every policy flag with its label as the reason', () => {
    const r = decideSubmission({ ...strong, policyFlags: ['brochure'] });
    expect(r?.decision).toBe('hold');
    expect(r?.reasons[0]).toMatch(/brochure/);
    expect(
      decideIngestPromote({ ...strong, policyFlags: ['lead_gen'] })?.decision,
    ).toBe('hold');
  });

  it("doesn't wait on a repo check for a hosted product with a live endpoint", () => {
    expect(
      decideSubmission({
        ...hosted,
        triageVerdict: 'approve',
        repoStatus: null,
      })?.decision,
    ).toBe('approve');
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

describe('decideSubmissionFromStored', () => {
  it('re-runs the gate on stored evidence, tolerating missing fields', () => {
    expect(decideSubmissionFromStored(JSON.stringify(strong))?.decision).toBe(
      'approve',
    );
    expect(
      decideSubmissionFromStored(
        JSON.stringify({ triageVerdict: 'reject', repoStatus: 'ok' }),
      )?.decision,
    ).toBe('reject');
    expect(decideSubmissionFromStored('not json')).toBeNull();
    expect(decideSubmissionFromStored(null)).toBeNull();
  });
});
