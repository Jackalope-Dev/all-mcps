import { CircleCheck, CircleHelp, KeyRound, Package } from 'lucide-react';
import type { Server } from '../../lib/servers';
import {
  computeTrustTier,
  TRUST_TIER_COPY,
  type TrustTier,
} from '../../lib/trustTier';
import { IconTooltip } from './IconTooltip';

const TIER_UI: Record<TrustTier, { color: string; Icon: typeof CircleCheck }> =
  {
    verified: { color: 'var(--verified-green)', Icon: CircleCheck },
    runs_needs_keys: { color: 'var(--accent-color)', Icon: KeyRound },
    installable: { color: 'var(--text-secondary)', Icon: Package },
    unverified: { color: 'var(--status-paused)', Icon: CircleHelp },
  };

/**
 * How much evidence we have that this server actually works — see
 * lib/trustTier.ts. Sits next to the rating badge in the detail header and
 * reuses its pill styling so the two read as one row of facts.
 */
export function TrustTierBadge({ server }: { server: Server }) {
  const tier = computeTrustTier(server);
  const copy = TRUST_TIER_COPY[tier];
  const { color, Icon } = TIER_UI[tier];
  return (
    <IconTooltip
      label={copy.detail}
      trigger={
        <span className="mcp-rating-header-badge" style={{ color }}>
          <Icon size={13} aria-hidden="true" />
          <span>{copy.label}</span>
        </span>
      }
    >
      <span className="mcp-icon-tooltip-title">
        <Icon size={14} style={{ color }} aria-hidden="true" /> {copy.label}
      </span>
      <span>{copy.detail}</span>
    </IconTooltip>
  );
}
