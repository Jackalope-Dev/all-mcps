import { ImageResponse } from 'next/og';
import { getEcosystemStats } from '@/lib/ecosystemStats';

// Share card with the live headline numbers — the thing that makes a link to
// this page worth clicking in a feed. Rendered per request (D1 isn't reachable
// at build; a static card would bake in the empty fallback). getEcosystemStats
// caches per isolate, and social crawlers fetch a card rarely.
export const dynamic = 'force-dynamic';

export const alt =
  'State of MCP: live statistics on the Model Context Protocol server ecosystem';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Dark-theme chart tokens from globals.css (--som-1 / --som-2), validated for
// CVD separation and contrast against the dark surface.
const C1 = '#00a5c4';
const C2 = '#4f7dff';

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function share(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export default async function Image() {
  const stats = await getEcosystemStats();

  const total = stats?.total ?? 0;
  const stdio =
    stats?.transport.find((t) => t.label === 'Local (stdio)')?.count ?? 0;
  const remote =
    stats?.transport.find((t) => t.label === 'Remote (HTTP)')?.count ?? 0;
  const runners = stats?.runners.reduce((a, b) => a + b.count, 0) ?? 0;
  const npx = stats?.runners.find((r) => r.label === 'npx')?.count ?? 0;
  const healthy = stats?.health.find((h) => h.label === 'healthy')?.count ?? 0;

  const rows = stats
    ? [
        {
          label: 'run locally over stdio',
          value: share(stdio, stdio + remote),
          color: C1,
        },
        {
          label: 'of local servers use npx',
          value: share(npx, runners),
          color: C1,
        },
        {
          label: 'passed latest health check',
          value: share(healthy, total),
          color: C2,
        },
      ]
    : [];

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 64px',
        background:
          'linear-gradient(135deg, #030712 0%, #080f24 45%, #0d1936 85%, #030712 100%)',
        fontFamily: 'sans-serif',
        color: '#ffffff',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-160px',
          right: '-120px',
          width: '620px',
          height: '620px',
          background:
            'radial-gradient(circle, rgba(0, 229, 255, 0.18) 0%, rgba(0, 123, 255, 0.05) 45%, transparent 70%)',
          display: 'flex',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            display: 'flex',
            width: '12px',
            height: '12px',
            borderRadius: '999px',
            background: '#22c55e',
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: '22px',
            letterSpacing: '0.18em',
            color: '#94a3b8',
            textTransform: 'uppercase',
          }}
        >
          {stats
            ? `State of MCP · live · ${stats.generatedAt.slice(0, 10)}`
            : 'State of MCP'}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '64px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div
            style={{
              display: 'flex',
              fontSize: stats ? '148px' : '96px',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1,
              backgroundImage: 'linear-gradient(135deg, #00E5FF, #007BFF)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {stats ? fmt(total) : 'State of MCP'}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: '18px',
              fontSize: '34px',
              color: '#e2e8f0',
              lineHeight: 1.25,
            }}
          >
            {stats
              ? 'active Model Context Protocol servers'
              : 'Live statistics on the MCP server ecosystem'}
          </div>
        </div>

        {rows.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '26px',
              width: '420px',
            }}
          >
            {rows.map((r) => (
              <div
                key={r.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '44px',
                      fontWeight: 700,
                      color: '#ffffff',
                    }}
                  >
                    {`${r.value}%`}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '22px',
                      color: '#94a3b8',
                    }}
                  >
                    {r.label}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    width: '100%',
                    height: '10px',
                    borderRadius: '999px',
                    background: 'rgba(148, 163, 184, 0.18)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: `${Math.max(2, r.value)}%`,
                      height: '10px',
                      borderRadius: '999px',
                      background: r.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '24px',
          fontSize: '24px',
          color: '#94a3b8',
        }}
      >
        <div style={{ display: 'flex', fontWeight: 700, color: '#ffffff' }}>
          <span style={{ color: '#00E5FF' }}>All</span>MCPs
        </div>
        <div style={{ display: 'flex' }}>allmcps.com/state-of-mcp</div>
      </div>
    </div>,
    { ...size },
  );
}
