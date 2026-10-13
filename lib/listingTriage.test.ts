import { describe, expect, it } from 'vitest';
import {
  explainTriage,
  type ListingReview,
  settleVerdict,
} from './listingReview';

const review: ListingReview = {
  isMcpServer: true,
  mcpServerProbability: 0.8,
  qualityScore: 3,
  reviewed: true,
};

describe('settleVerdict', () => {
  it('never rejects a server that completed a sandbox handshake', () => {
    expect(settleVerdict('reject', 0.99, review, { sandboxStatus: 'ok' })).toBe(
      'needs_review',
    );
    expect(
      settleVerdict('reject', 0.99, review, {
        sandboxStatus: 'needs_credentials',
      }),
    ).toBe('needs_review');
  });

  it('downgrades an unsure approve or reject', () => {
    expect(settleVerdict('approve', 0.5, review, {})).toBe('needs_review');
    expect(settleVerdict('reject', 0.5, review, {})).toBe('needs_review');
    expect(settleVerdict('approve', 0.9, review, {})).toBe('approve');
  });

  it('flags an approve that contradicts the is-MCP answer', () => {
    expect(
      settleVerdict('approve', 0.9, { ...review, isMcpServer: false }, {}),
    ).toBe('needs_review');
  });

  it('rejects a 404 source regardless of the model, unless it was proven to run', () => {
    expect(settleVerdict('approve', 0.95, review, { repoStatus: 'gone' })).toBe(
      'reject',
    );
    expect(
      settleVerdict('approve', 0.95, review, {
        repoStatus: 'gone',
        sandboxStatus: 'ok',
      }),
    ).toBe('needs_review');
  });

  it('passes through null when Jev had no answer', () => {
    expect(settleVerdict(null, null, review, {})).toBeNull();
  });
});

describe('explainTriage', () => {
  it('cites the evidence, not model prose', () => {
    expect(
      explainTriage('approve', review, { sandboxStatus: 'ok', toolCount: 4 }),
    ).toBe('Approve — MCP 80% · copy good · handshake ok (4 tools)');
  });
});
