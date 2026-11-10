import { describe, expect, it } from 'vitest';
import {
  assessStaleness,
  downFromHistory,
  evidenceReasons,
  isPayingListing,
  isRepoAlive,
  mayHideListing,
  pendingAutoRemoveReason,
  STALE_GRACE_MS,
  type StalenessInput,
  shouldAutoRemove,
} from './staleness';

const now = new Date('2026-10-13T00:00:00Z');
const base: StalenessInput = { now };
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

describe('assessStaleness: stale means unavailable', () => {
  it('never flags age, low activity, forks, deprecation or a failed sandbox', () => {
    // The retired rules ('abandoned', 'unmodified-fork', 'install-broken',
    // 'package-deprecated') have no inputs any more; a listing with none of
    // the availability signals is never stale, however quiet it is.
    expect(assessStaleness(base)).toEqual([]);
    expect(assessStaleness({ ...base, toolsSource: 'readme' })).toEqual([]);
  });

  it('calls a missing package stale only when no source repo is left', () => {
    expect(
      assessStaleness({ ...base, packageMissing: true, repoAlive: true }),
    ).toEqual([]);
    expect(assessStaleness({ ...base, packageMissing: true })).toEqual([
      'package-missing',
    ]);
    // Something else still runs it.
    expect(
      assessStaleness({
        ...base,
        packageMissing: true,
        remoteEndpointHealthy: true,
      }),
    ).toEqual([]);
    expect(
      assessStaleness({
        ...base,
        packageMissing: true,
        toolsSource: 'introspected',
      }),
    ).toEqual([]);
  });

  it('flags a remote endpoint down for weeks when no package runs it', () => {
    const down = { ...base, installKind: 'remote', endpointDown: true };
    expect(assessStaleness(down)).toEqual(['endpoint-down']);
    expect(assessStaleness({ ...down, packageAlive: true })).toEqual([]);
    expect(assessStaleness({ ...down, remoteEndpointHealthy: true })).toEqual(
      [],
    );
    // Only remote listings are judged on their endpoint.
    expect(assessStaleness({ ...down, installKind: 'stdio' })).toEqual([]);
  });

  it('leaves paid, claimed, official and featured listings to their owners', () => {
    const dead = { ...base, packageMissing: true, repoGoneConfirmed: true };
    expect(assessStaleness({ ...dead, isPremium: true })).toEqual([]);
    expect(assessStaleness({ ...dead, isOfficial: true })).toEqual([]);
    expect(assessStaleness({ ...dead, ownerUserId: 'u1' })).toEqual([]);
    expect(assessStaleness({ ...dead, curatorKeptAt: now })).toEqual([]);
    expect(assessStaleness({ ...dead, featuredUntil: inDays(1) })).toEqual([]);
    expect(
      assessStaleness({ ...dead, categorySponsorUntil: inDays(1) }),
    ).toEqual([]);
    // A lapsed payment no longer protects it.
    expect(
      assessStaleness({ ...dead, categorySponsorUntil: daysAgo(1) }),
    ).toEqual(['package-missing', 'repo-gone']);
  });
});

describe('paying listings', () => {
  it('counts active Premium, Featured and category sponsorship only', () => {
    expect(isPayingListing({ now, isPremium: true })).toBe(true);
    expect(isPayingListing({ now, featuredUntil: inDays(3) })).toBe(true);
    expect(isPayingListing({ now, categorySponsorUntil: inDays(3) })).toBe(
      true,
    );
    expect(isPayingListing({ now, featuredUntil: daysAgo(3) })).toBe(false);
    expect(isPayingListing({ now })).toBe(false);
  });

  it('are never hidden by the sweep, even on a security finding', () => {
    const paid = { ...base, isPremium: true, toolPoisoning: true };
    expect(assessStaleness(paid)).toEqual(['tool-poisoning']);
    expect(mayHideListing(paid)).toBe(false);
    expect(mayHideListing({ ...base, toolPoisoning: true })).toBe(true);
  });
});

describe('isRepoAlive', () => {
  it('trusts the repo check, then the health cron', () => {
    expect(isRepoAlive('ok', null)).toBe(true);
    expect(isRepoAlive('archived', 'archived')).toBe(true);
    expect(isRepoAlive('gone', 'healthy')).toBe(false);
    expect(isRepoAlive('site_only', 'healthy')).toBe(false);
    expect(isRepoAlive(null, 'healthy')).toBe(true);
    expect(isRepoAlive('unknown', 'archived')).toBe(true);
    expect(isRepoAlive(null, 'offline')).toBe(false);
  });
});

describe('shouldAutoRemove', () => {
  const flagged = new Date(now.getTime() - STALE_GRACE_MS);

  it('waits out the grace period', () => {
    expect(
      shouldAutoRemove(
        ['package-missing'],
        new Date(now.getTime() - 1000),
        now,
      ),
    ).toBe(false);
    expect(shouldAutoRemove(['package-missing'], flagged, now)).toBe(true);
  });

  it('never auto-removes on a model judgment, even mixed with hard signals', () => {
    expect(shouldAutoRemove(['not-mcp'], flagged, now)).toBe(false);
    expect(shouldAutoRemove(['package-missing', 'not-mcp'], flagged, now)).toBe(
      false,
    );
  });

  it('does nothing without reasons or a flag date', () => {
    expect(shouldAutoRemove([], flagged, now)).toBe(false);
    expect(shouldAutoRemove(['package-missing'], null, now)).toBe(false);
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
    expect(shouldAutoRemove(['package-missing'], eightDays, now)).toBe(false);
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
        packageMissing: true,
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
      shouldAutoRemove(['package-missing', 'typosquat'], longAgo, now),
    ).toBe(false);
  });
});

describe('malicious reports', () => {
  it('never hide a paid or claimed listing on their own', () => {
    expect(
      assessStaleness({ ...base, isPremium: true, maliciousReporters: 9 }),
    ).toEqual([]);
    expect(
      assessStaleness({
        ...base,
        categorySponsorUntil: inDays(5),
        maliciousReporters: 9,
      }),
    ).toEqual([]);
    expect(
      assessStaleness({ ...base, ownerUserId: 'u1', maliciousReporters: 9 }),
    ).toEqual([]);
  });
});

describe('site-down and endpoint-down history', () => {
  it('needs two weeks of unbroken failures, not a couple of bad checks', () => {
    expect(
      downFromHistory(
        { lastHealthyAt: daysAgo(20), firstFailAt: daysAgo(15), fails: 40 },
        now,
      ),
    ).toBe(true);
    // Recent outage: still inside the window.
    expect(
      downFromHistory(
        { lastHealthyAt: daysAgo(4), firstFailAt: daysAgo(3), fails: 12 },
        now,
      ),
    ).toBe(false);
    // Old but thin evidence: a single stale reading never counts.
    expect(
      downFromHistory(
        { lastHealthyAt: null, firstFailAt: daysAgo(30), fails: 2 },
        now,
      ),
    ).toBe(false);
    expect(downFromHistory(undefined, now)).toBe(false);
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
