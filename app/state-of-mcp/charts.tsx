import type { Bucket } from '@/lib/ecosystemStats';

// Server-rendered chart primitives for /state-of-mcp. Plain HTML + CSS (no chart
// library, no client JS): every value is printed as text beside its mark and
// repeated in a table, so the bars are decoration for sighted readers and the
// page stays fully readable to crawlers, screen readers and AI answer engines.
// Colors come from the --som-* tokens in globals.css (validated for CVD and
// contrast against both theme surfaces).

export function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  const p = (part / total) * 100;
  return `${p > 0 && p < 1 ? p.toFixed(1) : Math.round(p)}%`;
}

export function sum(buckets: Bucket[]): number {
  return buckets.reduce((a, b) => a + b.count, 0);
}

function DataTable({
  rows,
  total,
  labelHeader,
}: {
  rows: Bucket[];
  total: number;
  labelHeader: string;
}) {
  return (
    <details className="som-table">
      <summary>View as table</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">{labelHeader}</th>
            <th scope="col">Listings</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{fmt(r.count)}</td>
              <td>{pct(r.count, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Horizontal bar list — one series, one hue, value at the bar tip. */
export function BarList({
  rows,
  total,
  caption,
  labelHeader = 'Value',
}: {
  rows: Bucket[];
  total: number;
  caption: string;
  labelHeader?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <figure className="som-chart">
      <ul className="som-bars">
        {rows.map((r) => (
          <li
            key={r.label}
            className="som-bar-row"
            title={`${r.label}: ${fmt(r.count)} (${pct(r.count, total)})`}
          >
            <span className="som-bar-label">{r.label}</span>
            <span className="som-bar-track" aria-hidden="true">
              <span
                className="som-bar-fill"
                style={{ width: `${Math.max(0.6, (r.count / max) * 100)}%` }}
              />
            </span>
            <span className="som-bar-value">
              {fmt(r.count)}
              <span className="som-bar-share">{pct(r.count, total)}</span>
            </span>
          </li>
        ))}
      </ul>
      <figcaption>{caption}</figcaption>
      <DataTable rows={rows} total={total} labelHeader={labelHeader} />
    </figure>
  );
}

/**
 * Vertical columns for an ordered series (months). `partialLast` renders the
 * final column as a de-emphasized "so far" bar so an in-progress month never
 * reads as a collapse.
 */
export function ColumnChart({
  rows,
  caption,
  formatLabel = (l) => l,
  partialLast = false,
}: {
  rows: Bucket[];
  caption: string;
  formatLabel?: (label: string) => string;
  partialLast?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = sum(rows);
  return (
    <figure className="som-chart">
      <ul className="som-cols">
        {rows.map((r, i) => {
          const partial = partialLast && i === rows.length - 1;
          const label = `${formatLabel(r.label)}${partial ? ' (so far)' : ''}`;
          return (
            <li
              key={r.label}
              className={`som-col${partial ? ' som-col--partial' : ''}`}
              title={`${label}: ${fmt(r.count)}`}
            >
              <span className="som-col-value">{fmt(r.count)}</span>
              <span className="som-col-plot" aria-hidden="true">
                <span
                  className="som-col-fill"
                  style={{ height: `${Math.max(1.5, (r.count / max) * 100)}%` }}
                />
              </span>
              <span className="som-col-label">{label}</span>
            </li>
          );
        })}
      </ul>
      <figcaption>{caption}</figcaption>
      <DataTable
        rows={rows.map((r) => ({ ...r, label: formatLabel(r.label) }))}
        total={total}
        labelHeader="Month"
      />
    </figure>
  );
}

export type SplitSegment = {
  label: string;
  count: number;
  tone: 'primary' | 'secondary' | 'neutral';
};

/** One 100% stacked bar for a part-to-whole split (≤ 3 segments) + legend. */
export function SplitBar({
  segments,
  caption,
}: {
  segments: SplitSegment[];
  caption: string;
}) {
  const total = Math.max(
    1,
    segments.reduce((a, s) => a + s.count, 0),
  );
  return (
    <figure className="som-chart">
      <div className="som-split" aria-hidden="true">
        {segments.map((s) => (
          <span
            key={s.label}
            className={`som-split-seg som-tone--${s.tone}`}
            style={{ flexGrow: s.count }}
            title={`${s.label}: ${fmt(s.count)} (${pct(s.count, total)})`}
          />
        ))}
      </div>
      <ul className="som-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span
              className={`som-swatch som-tone--${s.tone}`}
              aria-hidden="true"
            />
            <span className="som-legend-label">{s.label}</span>
            <span className="som-legend-share">{pct(s.count, total)}</span>
            <span className="som-legend-count">{fmt(s.count)}</span>
          </li>
        ))}
      </ul>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function StatTile({
  value,
  label,
  href,
}: {
  value: string;
  label: string;
  href: string;
}) {
  return (
    <a className="som-stat" href={href}>
      <span className="som-stat-value">{value}</span>
      <span className="som-stat-label">{label}</span>
    </a>
  );
}
