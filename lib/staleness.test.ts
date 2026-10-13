import { describe, expect, it } from 'vitest';
import {
  assessStaleness,
  STALE_GRACE_MS,
  type StalenessInput,
  shouldAutoRemove,
} from './staleness';

const now = new Date('2026-10-13T00:00:00Z');
const twoYearsAgo = new Date('2024-10-01T00:00:00Z');
const base: StalenessInput = { now };

describe('assessStaleness', () => {
  it('never flags age alone', () => {
    expect(
      assessStaleness({ ...base, lastCommitAt: twoYearsAgo, githubStars: 400 }),
    ).toEqual([]);
  });

  it('flags an old, unverified listing with no traction as abandoned', () => {
    expect(
      assessStaleness({ ...base, lastCommitAt: twoYearsAgo, githubStars: 2 }),
    ).toEqual(['abandoned']);
  });

  it('does not call a verified server abandoned or broken', () => {
    expect(
      assessStaleness({
        ...base,
        lastCommitAt: twoYearsAgo,
        toolsSource: 'introspected',
        installFailures: 3,
        packageMissing: true,
      }),
    ).toEqual([]);
  });

  it('needs two install failures before calling an install broken', () => {
    expect(assessStaleness({ ...base, installFailures: 1 })).toEqual([]);
    expect(assessStaleness({ ...base, installFailures: 2 })).toEqual([
      'install-broken',
    ]);
  });

  it('flags a registry deprecation on its own', () => {
    expect(assessStaleness({ ...base, packageDeprecated: 'use @x/y' })).toEqual(
      ['package-deprecated'],
    );
  });

  it('flags forks without their own traction', () => {
    expect(
      assessStaleness({ ...base, repoForkOf: 'a/b', githubStars: 1 }),
    ).toEqual(['unmodified-fork']);
    expect(
      assessStaleness({ ...base, repoForkOf: 'a/b', githubStars: 50 }),
    ).toEqual([]);
  });

  it('leaves paid, claimed, official and featured listings to their owners', () => {
    const dead = { ...base, packageDeprecated: 'x', installFailures: 5 };
    expect(assessStaleness({ ...dead, isPremium: true })).toEqual([]);
    expect(assessStaleness({ ...dead, isOfficial: true })).toEqual([]);
    expect(assessStaleness({ ...dead, ownerUserId: 'u1' })).toEqual([]);
    expect(assessStaleness({ ...dead, curatorKeptAt: now })).toEqual([]);
    expect(
      assessStaleness({
        ...dead,
        featuredUntil: new Date(now.getTime() + 1000),
      }),
    ).toEqual([]);
  });
});

describe('shouldAutoRemove', () => {
  const flagged = new Date(now.getTime() - STALE_GRACE_MS);

  it('waits out the grace period', () => {
    expect(
      shouldAutoRemove(['abandoned'], new Date(now.getTime() - 1000), now),
    ).toBe(false);
    expect(shouldAutoRemove(['abandoned'], flagged, now)).toBe(true);
  });

  it('never auto-removes on a model judgment, even mixed with hard signals', () => {
    expect(shouldAutoRemove(['not-mcp'], flagged, now)).toBe(false);
    expect(shouldAutoRemove(['abandoned', 'not-mcp'], flagged, now)).toBe(
      false,
    );
  });

  it('does nothing without reasons or a flag date', () => {
    expect(shouldAutoRemove([], flagged, now)).toBe(false);
    expect(shouldAutoRemove(['abandoned'], null, now)).toBe(false);
  });
});
