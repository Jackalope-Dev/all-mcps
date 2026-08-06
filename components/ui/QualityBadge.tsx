import React from 'react';
import type { Server } from '../../lib/servers';
import { computeQualityScore, tierColor } from '../../lib/qualityScore';

/**
 * Transparent quality signal for a listing. `compact` renders just the score
 * chip (for cards); the default renders the score plus an expandable, native
 * <details> breakdown so users can see exactly how the signal was earned. This
 * is guidance, not a report card — the lowest tier is "Emerging", never "F".
 */
export function QualityBadge({ server, compact = false }: { server: Server; compact?: boolean }) {
  const q = computeQualityScore(server);
  const color = tierColor(q.tier);

  if (compact) {
    return (
      <span
        title={`Quality signal: ${q.tier} (${q.score}/100)`}
        aria-label={`Quality signal ${q.tier}, ${q.score} out of 100`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '1.6rem',
          height: '1.4rem',
          padding: '0 0.35rem',
          borderRadius: '6px',
          fontSize: '0.72rem',
          fontWeight: 800,
          color,
          background: `${color}1f`,
          border: `1px solid ${color}55`,
          flexShrink: 0,
        }}
      >
        {q.score}
      </span>
    );
  }

  return (
    <details className="surface" style={{ padding: '1.25rem' }}>
      <summary
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
          listStyle: 'none',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '2.5rem',
            height: '2.5rem',
            padding: '0 0.5rem',
            borderRadius: '10px',
            fontSize: '1.25rem',
            fontWeight: 800,
            color,
            background: `${color}1f`,
            border: `1px solid ${color}55`,
            flexShrink: 0,
          }}
        >
          {q.score}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            Quality signal: {q.tier} · {q.score}/100
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            How this signal is calculated ▾
          </span>
        </span>
      </summary>

      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {q.components.map((c) => {
          const notApplicable = c.applicable === false;
          const pct = c.max > 0 ? Math.round((c.earned / c.max) * 100) : 0;
          return (
            <div key={c.key} style={{ opacity: notApplicable ? 0.55 : 1 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  marginBottom: '0.25rem',
                }}
              >
                <span style={{ color: 'var(--text-primary)' }} title={c.hint}>
                  {c.label}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {notApplicable ? 'Not measured' : `${c.earned}/${c.max}`}
                </span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(128, 128, 128, 0.25)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                {!notApplicable && (
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: '3px',
                      background: 'var(--brand-gradient)',
                    }}
                  />
                )}
              </div>
              {notApplicable && (
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
                  {c.hint}
                </p>
              )}
            </div>
          );
        })}
        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
          A guidance signal from public completeness &amp; health data — not a user rating. New
          listings start lower and rise as they add docs, get verified, and grow adoption. Signals we
          can&apos;t observe for a listing are skipped, not counted against it.
        </p>
      </div>
    </details>
  );
}
