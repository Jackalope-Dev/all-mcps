import {
  Activity,
  CalendarClock,
  Download,
  GitCommitHorizontal,
  Star,
  TerminalSquare,
  ThumbsUp,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { formatCommitAge, formatCompactNumber } from '../../lib/format';
import {
  MAINTENANCE_STATUS_LABELS,
  type MaintenanceStatus,
} from '../../lib/serverEnums';

/**
 * Factual "how adopted / how maintained is this?" panel for /mcp/[id].
 *
 * Deliberately NOT a rating and NOT presented as reviews — every value here is a
 * real signal we already store (GitHub, npm, our own health/install checks,
 * directory engagement). It gives every listing page — including the long tail
 * with zero written reviews — a block of unique, listing-specific content, and
 * complements the real user reviews below it. No fabricated aggregates.
 */

export type AdoptionSignalsProps = {
  githubStars?: number | null;
  npmDownloads?: number | null;
  lastCommitAt?: string | Date | null;
  maintenanceStatus?: string | null;
  /** 0-100 combined remote-endpoint + stdio-pilot availability, when known. */
  availabilityPct?: number | null;
  /** Result of our automated stdio install check, when it has run. */
  installCheck?:
    | 'ok'
    | 'timeout'
    | 'handshake_failed'
    | 'install_failed'
    | 'error'
    | null;
  toolCount?: number | null;
  views?: number | null;
  copies?: number | null;
  upvotes?: number | null;
};

type Signal = {
  key: string;
  icon: ReactNode;
  label: string;
  value: string;
  caption: string;
};

const INSTALL_CHECK_LABEL: Record<
  NonNullable<AdoptionSignalsProps['installCheck']>,
  { value: string; caption: string }
> = {
  ok: {
    value: 'Passed',
    caption: 'Our sandbox started it and listed its tools.',
  },
  timeout: {
    value: 'Inconclusive',
    caption: "Didn't respond in our test window — often a slow first install.",
  },
  handshake_failed: {
    value: 'Inconclusive',
    caption: 'Started but did not complete the MCP handshake in our test.',
  },
  install_failed: {
    value: 'Inconclusive',
    caption: 'Install command did not finish in our automated test.',
  },
  error: {
    value: 'Inconclusive',
    caption: 'We hit an unexpected error running the automated check.',
  },
};

export function AdoptionSignals(props: AdoptionSignalsProps) {
  const signals: Signal[] = [];

  if (typeof props.githubStars === 'number' && props.githubStars > 0) {
    signals.push({
      key: 'stars',
      icon: <Star size={15} />,
      label: 'GitHub stars',
      value: formatCompactNumber(props.githubStars),
      caption: 'Stargazers on the source repository.',
    });
  }

  if (typeof props.npmDownloads === 'number' && props.npmDownloads > 0) {
    signals.push({
      key: 'npm',
      icon: <Download size={15} />,
      label: 'npm downloads',
      value: formatCompactNumber(props.npmDownloads),
      caption: 'Package downloads in the last 30 days.',
    });
  }

  const commitAge = formatCommitAge(props.lastCommitAt);
  if (commitAge) {
    signals.push({
      key: 'commit',
      icon: <GitCommitHorizontal size={15} />,
      label: 'Last commit',
      value: commitAge,
      caption: 'Most recent push to the default branch.',
    });
  }

  const maint = props.maintenanceStatus as MaintenanceStatus | null | undefined;
  if (maint && MAINTENANCE_STATUS_LABELS[maint]) {
    signals.push({
      key: 'maintenance',
      icon: <CalendarClock size={15} />,
      label: 'Maintenance',
      value: MAINTENANCE_STATUS_LABELS[maint],
      caption: 'Status declared by the project or listing owner.',
    });
  }

  if (typeof props.availabilityPct === 'number') {
    signals.push({
      key: 'availability',
      icon: <Activity size={15} />,
      label: 'Availability',
      value: `${Math.round(props.availabilityPct)}%`,
      caption: 'Our rolling endpoint + install checks that succeeded.',
    });
  }

  if (props.installCheck) {
    const m = INSTALL_CHECK_LABEL[props.installCheck];
    signals.push({
      key: 'install-check',
      icon: <TerminalSquare size={15} />,
      label: 'Install check',
      value: m.value,
      caption: m.caption,
    });
  }

  if (typeof props.toolCount === 'number' && props.toolCount > 0) {
    signals.push({
      key: 'tools',
      icon: <Wrench size={15} />,
      label: 'Tools exposed',
      value: String(props.toolCount),
      caption: 'Callable tools this server registers over MCP.',
    });
  }

  const engagement =
    (props.views || 0) + (props.copies || 0) + (props.upvotes || 0);
  if (engagement > 0) {
    signals.push({
      key: 'engagement',
      icon: <ThumbsUp size={15} />,
      label: 'Directory activity',
      value:
        [
          props.copies ? `${formatCompactNumber(props.copies)} installs` : null,
          props.upvotes
            ? `${formatCompactNumber(props.upvotes)} upvotes`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || `${formatCompactNumber(props.views || 0)} views`,
      caption: 'Config copies, upvotes, and views on AllMCPs.',
    });
  }

  if (signals.length < 2) return null;

  return (
    <section
      className="surface"
      style={{ padding: '1.75rem', marginTop: '2rem' }}
      aria-labelledby="adoption-signals-heading"
    >
      <h2
        id="adoption-signals-heading"
        style={{
          fontSize: '1.35rem',
          margin: '0 0 0.4rem',
          color: 'var(--text-primary)',
        }}
      >
        Adoption &amp; maintenance
      </h2>
      <p
        style={{
          margin: '0 0 1.25rem',
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.55,
        }}
      >
        Factual signals from GitHub, npm, and our automated checks — not a
        rating.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {signals.map((s) => (
          <div
            key={s.key}
            style={{
              padding: '0.9rem 1rem',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-elevated)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              <span style={{ color: 'var(--accent-color)' }}>{s.icon}</span>
              {s.label}
            </div>
            <div
              style={{
                margin: '0.35rem 0 0.2rem',
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}
            >
              {s.caption}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
