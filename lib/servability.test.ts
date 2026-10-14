import { describe, expect, it } from 'vitest';
import { isServable } from './servability';

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
    for (const status of ['pending', 'rejected', 'removed', '', null]) {
      expect(isServable({ status })).toBe(false);
    }
  });
});
