import { describe, expect, it } from 'vitest';
import { isServable, isWithdrawn } from './servability';

describe('isServable', () => {
  it('serves active, unflagged listings', () => {
    expect(isServable({ status: 'active', staleFlaggedAt: null })).toBe(true);
    expect(isServable({ status: 'active' })).toBe(true);
  });

  it('hides flagged listings even while active', () => {
    expect(isServable({ status: 'active', staleFlaggedAt: new Date() })).toBe(
      false,
    );
  });

  it('hides every non-active status', () => {
    for (const status of [
      'pending',
      'rejected',
      'removed',
      'withdrawn',
      '',
      null,
    ]) {
      expect(isServable({ status })).toBe(false);
    }
  });
});

describe('isWithdrawn', () => {
  it('is true only for an owner takedown, not for auto-removal', () => {
    expect(isWithdrawn({ status: 'withdrawn' })).toBe(true);
    for (const status of ['active', 'pending', 'removed', null]) {
      expect(isWithdrawn({ status })).toBe(false);
    }
  });
});
