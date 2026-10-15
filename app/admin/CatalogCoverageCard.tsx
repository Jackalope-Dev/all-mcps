'use client';

import { Gauge, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CatalogCoverage, DemandGap } from '@/lib/catalogCoverage';
import { AdminCardHead } from './AdminUi';

type CoverageResponse = {
  coverage: CatalogCoverage;
  demandGaps: DemandGap[];
};

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

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
    <div className="adm-grid-2">
      <div className="adm-card">
        <AdminCardHead icon={Gauge} hue="hue-cyan" title="Catalog coverage" />
        <p className="adm-card-sub">
          {data
            ? `Share of ${total.toLocaleString()} servable listings (active, not flagged) with each field. Hover a row for what fills it.`
            : failed
              ? 'Coverage could not be loaded.'
              : 'Loading coverage…'}
        </p>
        {!data && !failed && (
          <div className="adm-skel-bars" aria-hidden="true">
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        )}
        {data && (
          <ul className="adm-bars hue-cyan">
            {data.coverage.fields.map((f) => {
              const p = pct(f.count, total);
              return (
                <li key={f.key} title={f.hint}>
                  <div className="adm-bar-row">
                    <span>{f.label}</span>
                    <span className="adm-num">
                      {f.count.toLocaleString()} · {p}%
                    </span>
                  </div>
                  <div
                    className="adm-bar"
                    role="progressbar"
                    aria-label={f.label}
                    aria-valuenow={p}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${p}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="adm-card">
        <AdminCardHead icon={SearchX} hue="hue-amber" title="Demand gaps" />
        <p className="adm-card-sub">
          Searches that found nothing in the last 30 days, most frequent first.
          Candidates to source or write about.
        </p>
        {data && data.demandGaps.length === 0 && (
          <p className="adm-card-empty">No missed searches recorded yet.</p>
        )}
        {data && data.demandGaps.length > 0 && (
          <table className="adm-mini-table">
            <thead>
              <tr>
                <th>Query</th>
                <th>Where</th>
                <th className="is-num">Misses</th>
              </tr>
            </thead>
            <tbody>
              {data.demandGaps.map((g) => (
                <tr key={g.query}>
                  <td className="is-query">{g.query}</td>
                  <td className="is-muted">{g.surface}</td>
                  <td className="is-num">{g.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
