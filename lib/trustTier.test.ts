import { describe, expect, it } from 'vitest';
import { computeTrustTier } from './trustTier';

describe('computeTrustTier', () => {
  it('treats a completed handshake as verified, from either transport', () => {
    expect(computeTrustTier({ toolsSource: 'introspected' })).toBe('verified');
    expect(computeTrustTier({ remoteEndpointHealthy: true })).toBe('verified');
  });

  it('ranks a sandbox start that wanted keys above a mere install hint', () => {
    expect(
      computeTrustTier({
        installNeedsConfig: new Date(),
        installKind: 'stdio',
        installPackage: 'x',
      }),
    ).toBe('runs_needs_keys');
  });

  it('needs both an install kind and a package to be installable', () => {
    expect(
      computeTrustTier({ installKind: 'stdio', installPackage: 'x' }),
    ).toBe('installable');
    expect(computeTrustTier({ installKind: 'stdio' })).toBe('unverified');
    expect(computeTrustTier({ toolsSource: 'readme' })).toBe('unverified');
  });

  it('lets a confident not-an-MCP-server verdict cap an install hint, but never a handshake', () => {
    const hint = {
      installKind: 'stdio',
      installPackage: 'x',
      mcpProbability: 0.05,
    };
    expect(computeTrustTier(hint)).toBe('unverified');
    expect(computeTrustTier({ ...hint, toolsSource: 'introspected' })).toBe(
      'verified',
    );
  });
});
