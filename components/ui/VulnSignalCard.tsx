import { Shield } from 'lucide-react';
import { statusHueClass } from '../../lib/palette';
import type { Server } from '../../lib/servers';

/**
 * Supply-chain vulnerability signal — deliberately calm and informational,
 * never an alarm banner. Most advisories in a typical dependency tree are
 * low-severity/transitive noise, not an exploitable issue in this specific
 * server's actual usage, so this reads as a plain-language breakdown with a
 * neutral count grid, not a warning widget. The only visual escalation is a
 * cooler-but-not-red indigo tint on the critical count specifically — see
 * tierColor('Fair') in lib/qualityScore.ts, this codebase's existing
 * "elevated but not alarming" color (there is no red in the quality-tier
 * palette at all).
 */
export function VulnSignalCard({ server }: { server: Server }) {
  if (server.vulnScannedAt == null) return null;

  const critical = server.vulnCriticalCount || 0;
  const high = server.vulnHighCount || 0;
  const medium = server.vulnMediumCount || 0;
  const low = server.vulnLowCount || 0;
  const highSeverityCount = critical + high;
  const packageName = server.installPackage || '';
  const ecosystem = server.vulnEcosystem;

  const scannedAt = new Date(server.vulnScannedAt as any);
  const relativeTime = formatRelativeTime(scannedAt);

  const osvListUrl =
    ecosystem && packageName
      ? `https://osv.dev/list?ecosystem=${encodeURIComponent(ecosystem)}&q=${encodeURIComponent(packageName)}`
      : null;

  return (
    <div className="lst-card lst-stack">
      <div className="lst-card-head">
        {/* Status tile: green when the scan is clean, amber (never red) when
            high-severity advisories are on record. */}
        <span
          className={`lst-card-icon tint-tile ${statusHueClass(highSeverityCount === 0 ? 'ok' : 'warn')}`}
        >
          <Shield size={15} aria-hidden="true" />
        </span>
        <h3>Supply-chain signal</h3>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        {highSeverityCount === 0
          ? 'No high-severity advisories surfaced by our automated scan.'
          : `${highSeverityCount} high-severity advisor${highSeverityCount === 1 ? 'y' : 'ies'} on record for this package. Most advisories affect transitive dependencies and may not be exploitable in this server's actual usage — this is a directional signal, not a security audit.`}
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.6rem 1.1rem',
          fontSize: '0.8rem',
        }}
      >
        <span
          className={critical > 0 ? 'hue-indigo tint-text' : undefined}
          style={{
            color: critical > 0 ? undefined : 'var(--text-secondary)',
            fontWeight: critical > 0 ? 700 : 400,
          }}
        >
          Critical <strong>{critical}</strong>
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          High <strong style={{ color: 'var(--text-primary)' }}>{high}</strong>
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          Medium{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{medium}</strong>
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          Low <strong style={{ color: 'var(--text-primary)' }}>{low}</strong>
        </span>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--border-color)',
        }}
      >
        Scanned {relativeTime} via{' '}
        {osvListUrl ? (
          <a
            href={osvListUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-color)' }}
          >
            OSV.dev
          </a>
        ) : (
          'OSV.dev'
        )}
        {packageName && ecosystem ? ` · ${packageName} (${ecosystem})` : ''}
      </p>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
