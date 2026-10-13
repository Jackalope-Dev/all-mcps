/**
 * How much evidence we have that a listing is a working MCP server.
 *
 * One ladder, derived at render time from signals we already store, so it can
 * never drift from them. Each rung is a stronger claim than the one below and
 * the copy for each says exactly what was observed — nothing here is inferred
 * from popularity or from a README.
 *
 *   verified        we completed a real initialize + tools/list handshake
 *                   (E2B sandbox for stdio, live HTTP for remote endpoints)
 *   runs_needs_keys it installed and started in a sandbox, then stopped for
 *                   configuration (API key, path) a bare sandbox can't supply
 *   installable     we know how to install it and the package/endpoint exists
 *   unverified      none of the above yet
 */

export type TrustTier =
  | 'verified'
  | 'runs_needs_keys'
  | 'installable'
  | 'unverified';

export type TrustTierInput = {
  toolsSource?: string | null;
  installNeedsConfig?: string | Date | number | null;
  installKind?: string | null;
  installPackage?: string | null;
  remoteEndpointHealthy?: boolean | null;
  /** Jev's is-an-MCP-server probability. A confident "no" caps the tier. */
  mcpProbability?: number | null;
};

/** Below this, Jev's "not an MCP server" overrides an installable-looking package. Matches MCP_SERVER_NOUL_FLOOR. */
const NOT_MCP_FLOOR = 0.15;

export function computeTrustTier(s: TrustTierInput): TrustTier {
  if (s.toolsSource === 'introspected' || s.remoteEndpointHealthy === true) {
    return 'verified';
  }
  if (s.installNeedsConfig != null) return 'runs_needs_keys';
  if (typeof s.mcpProbability === 'number' && s.mcpProbability < NOT_MCP_FLOOR)
    return 'unverified';
  if (s.installKind && s.installPackage) return 'installable';
  return 'unverified';
}

export const TRUST_TIER_COPY: Record<
  TrustTier,
  { label: string; detail: string }
> = {
  verified: {
    label: 'Verified working',
    detail:
      'We ran this server and completed a real MCP handshake, listing its tools.',
  },
  runs_needs_keys: {
    label: 'Runs, needs keys',
    detail:
      'It installed and started in our sandbox, then stopped for configuration such as an API key.',
  },
  installable: {
    label: 'Installable',
    detail:
      'We know how to install it, but have not yet seen it complete a handshake.',
  },
  unverified: {
    label: 'Unverified',
    detail: 'We have not yet confirmed this server installs or runs.',
  },
};

/** Higher = stronger evidence. For sorting. */
export const TRUST_TIER_RANK: Record<TrustTier, number> = {
  verified: 3,
  runs_needs_keys: 2,
  installable: 1,
  unverified: 0,
};
