import { describe, expect, it } from 'vitest';
import {
  deriveTriageVerdict,
  explainTriage,
  type ListingReview,
  settleVerdict,
  type TriageMatrix,
  toolNamesFromJson,
} from './listingReview';

const review: ListingReview = {
  isMcpServer: true,
  mcpServerProbability: 0.8,
  qualityScore: 3,
  reviewed: true,
};

const strong: TriageMatrix = {
  isMcpServer: 0.8,
  isSubstantive: 0.9,
  isUsable: 0.7,
  isLegitimate: 0.95,
  belongsInDirectory: 0.85,
};

describe('deriveTriageVerdict', () => {
  it('approves when every question clears its bar, at the weakest probability', () => {
    expect(deriveTriageVerdict(strong)).toEqual({
      verdict: 'approve',
      confidence: 0.7,
    });
  });

  it.each([
    ['is-MCP', { isMcpServer: 0.55 }],
    ['substance', { isSubstantive: 0.35 }],
    ['usability', { isUsable: 0.4 }],
    ['legitimacy', { isLegitimate: 0.45 }],
    ['the overall answer', { belongsInDirectory: 0.25 }],
    ['a missing answer', { isUsable: null }],
  ])('asks a human when %s falls short', (_label, patch) => {
    expect(deriveTriageVerdict({ ...strong, ...patch })?.verdict).toBe(
      'needs_review',
    );
  });

  it.each([
    ['not an MCP server', { isMcpServer: 0.02 }],
    ['a placeholder repo', { isSubstantive: 0.05 }],
    ['spam', { isLegitimate: 0.1 }],
    ['not belonging', { belongsInDirectory: 0.08 }],
  ])('rejects when one hard question is confidently no: %s', (_l, patch) => {
    const r = deriveTriageVerdict({ ...strong, ...patch });
    expect(r?.verdict).toBe('reject');
    expect(r?.confidence).toBeGreaterThan(0.85);
  });

  it('never rejects on usability alone', () => {
    expect(deriveTriageVerdict({ ...strong, isUsable: 0.01 })?.verdict).toBe(
      'needs_review',
    );
  });

  it('has no verdict without an is-MCP answer', () => {
    expect(deriveTriageVerdict({ ...strong, isMcpServer: null })).toBeNull();
  });
});

describe('settleVerdict', () => {
  it('never rejects a server that completed a sandbox handshake', () => {
    expect(settleVerdict('reject', { sandboxStatus: 'ok' })).toBe(
      'needs_review',
    );
    expect(
      settleVerdict('reject', { sandboxStatus: 'needs_credentials' }),
    ).toBe('needs_review');
  });

  it('rejects a 404 source regardless of the model, unless it was proven to run', () => {
    expect(settleVerdict('approve', { repoStatus: 'gone' })).toBe('reject');
    expect(
      settleVerdict('approve', { repoStatus: 'gone', sandboxStatus: 'ok' }),
    ).toBe('needs_review');
  });

  it('passes the matrix verdict through otherwise', () => {
    expect(settleVerdict('approve', {})).toBe('approve');
    expect(settleVerdict(null, {})).toBeNull();
  });
});

describe('explainTriage', () => {
  it('cites the evidence, not model prose', () => {
    expect(
      explainTriage('approve', review, { sandboxStatus: 'ok', toolCount: 4 }),
    ).toBe('Approve — MCP 80% · copy good · handshake ok (4 tools)');
  });

  it('lists each matrix answer', () => {
    expect(explainTriage('approve', review, {}, strong)).toBe(
      'Approve — MCP 80% · real project 90% · usable 70% · legit 95% · belongs 85% · copy good',
    );
  });
});

describe('toolNamesFromJson', () => {
  it('reads names and tolerates junk', () => {
    expect(toolNamesFromJson('[{"name":"a"},{"x":1},{"name":"b"}]')).toEqual([
      'a',
      'b',
    ]);
    expect(toolNamesFromJson('not json')).toEqual([]);
    expect(toolNamesFromJson(null)).toEqual([]);
  });
});
