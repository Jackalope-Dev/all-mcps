'use client';

import { Gauge, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CatalogCoverage, DemandGap } from '@/lib/catalogCoverage';

type CoverageResponse = {
  coverage: CatalogCoverage;
  demandGaps: DemandGap[];
};

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

const cardHeader = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.5rem',
} as const;

const cardIntro = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  marginBottom: '1rem',
} as const;

/**
 * Field-by-field completeness of the servable catalog, plus the searches that
 * found nothing. Fetched on mount from /api/admin/coverage so the aggregate
 * pass does not run on every stats-bar refresh.
 */
export function CatalogCoverageCard() {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/coverage')
      .then((res) =>
        res.ok
          ? (res.json() as Promise<CoverageResponse>)
          : Promise.reject(res.status),
      )
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = data?.coverage.total ?? 0;

  return (
    <div
      className="admin-grid-2"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
      }}
    >
      <div className="admin-card" style={{ padding: '1.25rem' }}>
        <div style={cardHeader}>
          <Gauge
            className="w-5 h-5"
            style={{ color: 'var(--accent-color)' }}
            aria-hidden="true"
          />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
            Catalog Coverage
          </h3>
        </div>
        <p style={cardIntro}>
          {data
            ? `Share of ${total.toLocaleString()} servable listings (active, not flagged) with each field. Hover a row for what fills it.`
            : failed
              ? 'Coverage could not be loaded.'
              : 'Loading coverage…'}
        </p>
        {data && (
          <ul
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {data.coverage.fields.map((f) => {
              const p = pct(f.count, total);
              return (
                <li key={f.key} title={f.hint}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem',
                      marginBottom: '0.2rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-primary)' }}>
                      {f.label}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {f.count.toLocaleString()} · {p}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={f.label}
                    aria-valuenow={p}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{
                      height: '6px',
                      borderRadius: '3px',
                      background: 'rgba(128, 128, 128, 0.15)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${p}%`,
                        height: '100%',
                        background: 'var(--accent-color)',
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="admin-card" style={{ padding: '1.25rem' }}>
        <div style={cardHeader}>
          <SearchX
            className="w-5 h-5"
            style={{ color: '#f59e0b' }}
            aria-hidden="true"
          />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
            Demand Gaps
          </h3>
        </div>
        <p style={cardIntro}>
          Searches that found nothing in the last 30 days, most frequent first.
          Candidates to source or write about.
        </p>
        {data && data.demandGaps.length === 0 && (
          <div
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
            }}
          >
            No missed searches recorded yet.
          </div>
        )}
        {data && data.demandGaps.length > 0 && (
          <table
            style={{
              width: '100%',
              fontSize: '0.85rem',
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '0.3rem 0', fontWeight: 500 }}>Query</th>
                <th style={{ padding: '0.3rem 0', fontWeight: 500 }}>Where</th>
                <th
                  style={{
                    padding: '0.3rem 0',
                    fontWeight: 500,
                    textAlign: 'right',
                  }}
                >
                  Misses
                </th>
              </tr>
            </thead>
            <tbody>
              {data.demandGaps.map((g) => (
                <tr
                  key={g.query}
                  style={{ borderTop: '1px solid var(--border-color)' }}
                >
                  <td
                    style={{
                      padding: '0.35rem 0',
                      color: 'var(--text-primary)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {g.query}
                  </td>
                  <td
                    style={{
                      padding: '0.35rem 0.5rem 0.35rem 0',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {g.surface}
                  </td>
                  <td style={{ padding: '0.35rem 0', textAlign: 'right' }}>
                    {g.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
