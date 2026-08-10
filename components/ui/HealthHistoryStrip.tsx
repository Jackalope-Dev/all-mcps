import type { ServerHealthCheck } from '../../lib/servers';

function spanLabel(oldest: string | Date): string {
  const hours = (Date.now() - new Date(oldest).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return 'the last hour';
  if (hours < 36) return `the last ${Math.round(hours)}h`;
  return `the last ${Math.round(hours / 24)}d`;
}

/**
 * Compact bar-strip of recent health-check results, oldest to newest —
 * turns a single point-in-time status into a trend, so one transient blip
 * (a slow origin response, a brief network hiccup) doesn't read as "this
 * listing is broken" the way a single red badge does (see the incident this
 * was built from: our own listing showed "Unreachable" from a one-off
 * Worker memory spike, not a real outage).
 */
interface HealthHistoryStripProps {
  history: ServerHealthCheck[];
  pilotResult?: { status?: string | null } | null;
  hasRemoteEndpoint?: boolean;
  isOfficial?: boolean;
}

export function HealthHistoryStrip({
  history,
  pilotResult,
  hasRemoteEndpoint,
  isOfficial,
}: HealthHistoryStripProps) {
  // Too little data yet to read as a trend — the single health dot elsewhere
  // on the page already covers "what's the status right now".
  if (history.length < 4) return null;

  const healthyCount = history.filter((h) => h.healthy).length;
  const oldest = history[0]?.checkedAt;

  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div
        style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: '16px' }}
        role="img"
        aria-label={`${healthyCount} of ${history.length} recent health checks succeeded, over ${spanLabel(oldest)}.`}
      >
        {history.map((h, i) => {
          const isPrimaryPass = h.healthy || isOfficial;
          const isRemotePass = h.remoteHealthy === true || (isOfficial && hasRemoteEndpoint);
          const isRemoteFail = h.remoteHealthy === false && !isOfficial;

          const dateStr = new Date(h.checkedAt).toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short',
          });

          const lines: string[] = [
            dateStr,
            `• Primary URL / Repo: ${isPrimaryPass ? 'Pass' : h.detail ? `Issue (${h.detail})` : 'Issue'}`,
          ];

          if (hasRemoteEndpoint || h.remoteHealthy != null) {
            lines.push(
              `• Remote Endpoint: ${
                isRemotePass ? 'Pass (Live)' : isRemoteFail ? 'Fail (Unreachable)' : 'Not checked'
              }`
            );
          }

          if (pilotResult) {
            lines.push(
              `• Stdio Sandbox: ${
                pilotResult.status === 'ok'
                  ? 'Pass'
                  : pilotResult.status
                    ? `Issue (${pilotResult.status})`
                    : 'Pending'
              }`
            );
          }

          const tipText = lines.join('\n');
          const isOverallHealthy = isPrimaryPass && !isRemoteFail;

          return (
            <span
              key={i}
              className="health-dot"
              tabIndex={0}
              data-tip={tipText}
              style={{
                flex: '1 1 0',
                minWidth: '2px',
                maxWidth: '4px',
                height: '100%',
                borderRadius: '1px',
                backgroundColor: isOverallHealthy
                  ? 'rgba(16, 185, 129, 0.55)'
                  : 'rgba(248, 113, 113, 0.9)',
                outline: 'none',
              }}
            />
          );
        })}
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
        {healthyCount}/{history.length} checks healthy over {spanLabel(oldest)}
      </div>
    </div>
  );
}
