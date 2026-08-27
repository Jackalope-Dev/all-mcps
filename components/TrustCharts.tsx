'use client';

import {
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from 'react';

export type TrendPoint = { date: string; total: number; ai: number };

function formatCompact(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return `${n}`;
}

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Round a max value up to a visually clean gridline step (1 / 2 / 5 x 10^n). */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const frac = value / base;
  const step = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  const result = step * base;
  // A max of 1 puts the 0/0.5/1 gridlines at rounded values 0, 1, 1 — same label twice.
  return result <= 1 ? 2 : result;
}

const WIDTH = 720;
const HEIGHT = 240;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

/**
 * Emphasis line/area chart: total daily API hits as muted context, AI-assistant
 * hits as the accent story on top, with a crosshair + shared tooltip on hover/focus.
 */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) return null;

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = niceMax(Math.max(...data.map((d) => d.total), 1));
  const step = plotW / Math.max(data.length - 1, 1);

  const xAt = (i: number) => PAD_LEFT + i * step;
  const yAt = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  const totalPath = data
    .map(
      (d, i) =>
        `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.total).toFixed(1)}`,
    )
    .join(' ');
  const aiPath = data
    .map(
      (d, i) =>
        `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(d.ai).toFixed(1)}`,
    )
    .join(' ');
  const totalArea = `${totalPath} L ${xAt(data.length - 1).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`;

  const gridSteps = [0, 0.5, 1];

  function updateFromClientX(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const vbX = ratio * WIDTH;
    const idx = Math.round((vbX - PAD_LEFT) / step);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    updateFromClientX(e.clientX);
  }

  function onPointerLeave() {
    setHoverIdx(null);
  }

  function onKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setHoverIdx((i) => Math.min(data.length - 1, (i ?? -1) + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setHoverIdx((i) => Math.max(0, (i ?? data.length) - 1));
    } else if (e.key === 'Escape') {
      setHoverIdx(null);
    }
  }

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  const tooltipLeftPct = hoverIdx !== null ? (xAt(hoverIdx) / WIDTH) * 100 : 0;
  const tooltipAlignRight = tooltipLeftPct > 65;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          touchAction: 'pan-y',
        }}
        role="img"
        aria-label="Daily API traffic over the last 30 days, total requests versus AI assistant requests"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        onFocus={() => setHoverIdx((i) => (i === null ? data.length - 1 : i))}
        onBlur={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="trustTrendArea" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop
              offset="0%"
              stopColor="var(--text-secondary)"
              stopOpacity="0.18"
            />
            <stop
              offset="100%"
              stopColor="var(--text-secondary)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {gridSteps.map((g) => {
          const y = PAD_TOP + plotH - g * plotH;
          return (
            <g key={g}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--border-color)"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="var(--text-secondary)"
              >
                {formatCompact(Math.round(g * max))}
              </text>
            </g>
          );
        })}

        <path d={totalArea} fill="url(#trustTrendArea)" />
        <path
          d={totalPath}
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.55}
        />
        <path
          d={aiPath}
          fill="none"
          stroke="var(--brand-cyan)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle
          cx={xAt(data.length - 1)}
          cy={yAt(data[data.length - 1].ai)}
          r={4}
          fill="var(--brand-cyan)"
          stroke="var(--bg-elevated)"
          strokeWidth={2}
        />
        <circle
          cx={xAt(data.length - 1)}
          cy={yAt(data[data.length - 1].total)}
          r={4}
          fill="var(--text-secondary)"
          stroke="var(--bg-elevated)"
          strokeWidth={2}
          opacity={0.85}
        />

        {hoverIdx !== null && (
          <g>
            <line
              x1={xAt(hoverIdx)}
              x2={xAt(hoverIdx)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
              stroke="var(--text-secondary)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />
            <circle
              cx={xAt(hoverIdx)}
              cy={yAt(data[hoverIdx].ai)}
              r={5}
              fill="var(--brand-cyan)"
              stroke="var(--bg-elevated)"
              strokeWidth={2}
            />
            <circle
              cx={xAt(hoverIdx)}
              cy={yAt(data[hoverIdx].total)}
              r={5}
              fill="var(--text-secondary)"
              stroke="var(--bg-elevated)"
              strokeWidth={2}
            />
          </g>
        )}

        <text
          x={PAD_LEFT}
          y={HEIGHT - 6}
          fontSize={10}
          fill="var(--text-secondary)"
        >
          {formatDateLabel(data[0].date)}
        </text>
        <text
          x={WIDTH - PAD_RIGHT}
          y={HEIGHT - 6}
          textAnchor="end"
          fontSize={10}
          fill="var(--text-secondary)"
        >
          {formatDateLabel(data[data.length - 1].date)}
        </text>
      </svg>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: tooltipAlignRight ? undefined : `${tooltipLeftPct}%`,
            right: tooltipAlignRight ? `${100 - tooltipLeftPct}%` : undefined,
            transform: tooltipAlignRight
              ? 'translateX(12px)'
              : 'translateX(12px)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: '0.5rem 0.65rem',
            fontSize: '0.78rem',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            minWidth: 150,
            zIndex: 2,
          }}
        >
          <div
            style={{
              color: 'var(--text-secondary)',
              marginBottom: '0.35rem',
              fontWeight: 600,
            }}
          >
            {formatDateLabel(hovered.date)}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 2,
                  background: 'var(--brand-cyan)',
                  display: 'inline-block',
                  borderRadius: 1,
                }}
              />
              AI assistants
            </span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {formatCompact(hovered.ai)}
            </strong>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              marginTop: '0.2rem',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 2,
                  background: 'var(--text-secondary)',
                  display: 'inline-block',
                  borderRadius: 1,
                  opacity: 0.6,
                }}
              />
              Total requests
            </span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {formatCompact(hovered.total)}
            </strong>
          </div>
        </div>
      )}

      <ul
        style={{
          listStyle: 'none',
          display: 'flex',
          gap: '1.25rem',
          margin: '0.75rem 0 0',
          padding: 0,
        }}
      >
        <li
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span
            style={{
              width: 12,
              height: 2,
              background: 'var(--brand-cyan)',
              display: 'inline-block',
              borderRadius: 1,
            }}
          />
          AI assistants
        </li>
        <li
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span
            style={{
              width: 12,
              height: 2,
              background: 'var(--text-secondary)',
              display: 'inline-block',
              borderRadius: 1,
              opacity: 0.6,
            }}
          />
          Total requests
        </li>
      </ul>
    </div>
  );
}
