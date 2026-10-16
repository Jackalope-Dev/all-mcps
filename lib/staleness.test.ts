import { describe, expect, it } from 'vitest';
import {
  assessStaleness,
  evidenceReasons,
  pendingAutoRemoveReason,
  STALE_GRACE_MS,
  type StalenessInput,
  shouldAutoRemove,
  siteDownFromHistory,
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

describe('repo and Jev rules', () => {
  it('flags a confirmed-gone repo only when nothing else runs it', () => {
    expect(assessStaleness({ ...base, repoGoneConfirmed: true })).toEqual([
      'repo-gone',
    ]);
    expect(
      assessStaleness({ ...base, repoGoneConfirmed: true, packageAlive: true }),
    ).toEqual([]);
    expect(
      assessStaleness({
        ...base,
        repoGoneConfirmed: true,
        toolsSource: 'introspected',
      }),
    ).toEqual([]);
  });

  it('removes a gone repo after a week, not a month', () => {
    const eightDays = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    expect(shouldAutoRemove(['repo-gone'], eightDays, now)).toBe(true);
    expect(shouldAutoRemove(['abandoned'], eightDays, now)).toBe(false);
  });

  it('hides on a Jev reject only when the MCP probability agrees, and never removes on it', () => {
    expect(
      assessStaleness({
        ...base,
        triageVerdict: 'reject',
        mcpProbability: 0.2,
      }),
    ).toEqual(['jev-reject']);
    expect(
      assessStaleness({
        ...base,
        triageVerdict: 'reject',
        mcpProbability: 0.6,
      }),
    ).toEqual([]);
    const old = new Date(now.getTime() - STALE_GRACE_MS * 2);
    expect(shouldAutoRemove(['jev-reject'], old, now)).toBe(false);
  });

  it('keeps jev-reject out of the reasons that reset a verdict', () => {
    expect(evidenceReasons(['repo-gone', 'jev-reject'])).toEqual(['repo-gone']);
  });
});

describe('pendingAutoRemoveReason', () => {
  const p = {
    submitted: false,
    sandboxProven: false,
    repoGoneConfirmed: false,
    triageVerdict: null,
    mcpProbability: null,
  };
  it('removes ingested rows with a gone repo or an agreeing Jev reject', () => {
    expect(pendingAutoRemoveReason({ ...p, repoGoneConfirmed: true })).toMatch(
      /repo gone/,
    );
    expect(
      pendingAutoRemoveReason({
        ...p,
        triageVerdict: 'reject',
        mcpProbability: 0.1,
      }),
    ).toMatch(/Jev reject/);
    expect(
      pendingAutoRemoveReason({
        ...p,
        triageVerdict: 'reject',
        mcpProbability: 0.5,
      }),
    ).toBeNull();
  });
  it('never auto-removes a human submission or a proven server', () => {
    expect(
      pendingAutoRemoveReason({
        ...p,
        submitted: true,
        repoGoneConfirmed: true,
      }),
    ).toBeNull();
    expect(
      pendingAutoRemoveReason({
        ...p,
        sandboxProven: true,
        repoGoneConfirmed: true,
      }),
    ).toBeNull();
  });
});

describe('security reasons', () => {
  it('flags each security finding', () => {
    expect(
      assessStaleness({
        ...base,
        toolPoisoning: true,
        installRisk: true,
        typosquatOf: '@modelcontextprotocol/server-github',
        packageRepoMismatch: true,
        maliciousReporters: 3,
      }),
    ).toEqual([
      'tool-poisoning',
      'risky-install',
      'typosquat',
      'package-repo-mismatch',
      'reported-malicious',
    ]);
  });

  it('applies to paid and claimed listings, which skip staleness', () => {
    expect(
      assessStaleness({
        ...base,
        isPremium: true,
        ownerUserId: 'u1',
        lastCommitAt: twoYearsAgo,
        githubStars: 0,
        installRisk: true,
      }),
    ).toEqual(['risky-install']);
  });

  it('exempts official and curator-kept listings', () => {
    expect(
      assessStaleness({ ...base, isOfficial: true, toolPoisoning: true }),
    ).toEqual([]);
    expect(
      assessStaleness({ ...base, curatorKeptAt: now, typosquatOf: 'x' }),
    ).toEqual([]);
  });

  it('needs several distinct malicious reporters', () => {
    expect(assessStaleness({ ...base, maliciousReporters: 2 })).toEqual([]);
  });

  it('never auto-removes on a security reason', () => {
    const longAgo = new Date(now.getTime() - 10 * STALE_GRACE_MS);
    expect(shouldAutoRemove(['risky-install'], longAgo, now)).toBe(false);
    expect(
      shouldAutoRemove(['package-deprecated', 'typosquat'], longAgo, now),
    ).toBe(false);
  });
});

describe('malicious reports', () => {
  it('never hide a paid or claimed listing on their own', () => {
    expect(
      assessStaleness({ ...base, isPremium: true, maliciousReporters: 9 }),
    ).toEqual([]);
    expect(
      assessStaleness({ ...base, ownerUserId: 'u1', maliciousReporters: 9 }),
    ).toEqual([]);
  });
});

describe('site-down', () => {
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

  it('needs two weeks of unbroken failures, not a couple of bad checks', () => {
    expect(
      siteDownFromHistory(
        { lastHealthyAt: daysAgo(20), firstFailAt: daysAgo(15), fails: 40 },
        now,
      ),
    ).toBe(true);
    // Recent outage: still inside the window.
    expect(
      siteDownFromHistory(
        { lastHealthyAt: daysAgo(4), firstFailAt: daysAgo(3), fails: 12 },
        now,
      ),
    ).toBe(false);
    // Old but thin evidence: a single stale reading never counts.
    expect(
      siteDownFromHistory(
        { lastHealthyAt: null, firstFailAt: daysAgo(30), fails: 2 },
        now,
      ),
    ).toBe(false);
    expect(siteDownFromHistory(undefined, now)).toBe(false);
  });

  it('flags a down site only when nothing else runs it', () => {
    expect(assessStaleness({ ...base, siteDown: true })).toEqual(['site-down']);
    expect(
      assessStaleness({ ...base, siteDown: true, packageAlive: true }),
    ).toEqual([]);
    expect(
      assessStaleness({ ...base, siteDown: true, remoteEndpointHealthy: true }),
    ).toEqual([]);
  });

  it('removes after two more weeks of grace', () => {
    expect(shouldAutoRemove(['site-down'], daysAgo(15), now)).toBe(true);
    expect(shouldAutoRemove(['site-down'], daysAgo(10), now)).toBe(false);
  });
});
