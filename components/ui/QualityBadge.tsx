import React from 'react';
import type { Server } from '../../lib/servers';
import { computeQualityScore, tierColor } from '../../lib/qualityScore';

/**
 * Transparent quality grade for a listing. `compact` renders just the tier
 * chip (for cards); the default renders the score plus an expandable, native
 * <details> breakdown so users can see exactly how the grade was earned.
 */
export function QualityBadge({ server, compact = false }: { server: Server; compact?: boolean }) {
  const q = computeQualityScore(server);
  const color = tierColor(q.tier);

  if (compact) {
    return (
      <span
        title={`Quality grade ${q.tier} (${q.score}/100)`}
        aria-label={`Quality grade ${q.tier}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1.4rem',
          height: '1.4rem',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: 800,
          color,
          background: `${color}1f`,
          border: `1px solid ${color}55`,
          flexShrink: 0,
        }}
      >
        {q.tier}
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
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '10px',
            fontSize: '1.25rem',
            fontWeight: 800,
            color,
            background: `${color}1f`,
            border: `1px solid ${color}55`,
            flexShrink: 0,
          }}
        >
          {q.tier}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            Quality score: {q.score}/100
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            How this grade is calculated ▾
          </span>
        </span>
      </summary>

      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {q.components.map((c) => {
          const pct = c.max > 0 ? Math.round((c.earned / c.max) * 100) : 0;
          return (
            <div key={c.key}>
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
                  {c.earned}/{c.max}
                </span>
              </div>
              <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    borderRadius: '3px',
                    background: 'var(--brand-gradient)',
                  }}
                />
              </div>
            </div>
          );
        })}
        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
          An editorial completeness &amp; health score from public signals — not a user rating.
        </p>
      </div>
    </details>
  );
}
