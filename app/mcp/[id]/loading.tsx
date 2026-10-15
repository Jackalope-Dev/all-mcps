import type { CSSProperties } from 'react';

const sk = (width: CSSProperties['width'], height: number, r?: number) => ({
  width,
  height,
  ...(r != null ? { borderRadius: r } : {}),
});

/**
 * Shown immediately on navigation to /mcp/[id] while the page streams in.
 * Built from the same lst-* layout classes as the real page (header, sticky
 * section nav, install panel, sidebar) so the swap-in doesn't shift anything.
 */
export default function Loading() {
  return (
    <main className="container lst-page" aria-busy="true">
      <span className="sr-only">Loading listing…</span>
      <ol className="crumbs" aria-hidden="true">
        <li className="skeleton" style={sk(40, 14)} />
        <li className="skeleton" style={sk(90, 14)} />
        <li className="skeleton" style={sk(70, 14)} />
      </ol>

      <div className="lst-hero" aria-hidden="true">
        <div className="lst-hero-id">
          <div className="skeleton" style={sk(64, 64, 16)} />
          <div className="skeleton" style={sk('min(16rem, 50vw)', 34)} />
        </div>
        <div className="lst-hero-summary">
          <div className="skeleton" style={sk('100%', 16)} />
          <div
            className="skeleton"
            style={{ ...sk('62%', 16), marginTop: '0.6rem' }}
          />
        </div>
        <div className="lst-meta">
          {[96, 72, 104, 64, 88, 120].map((w) => (
            <div key={w} className="skeleton" style={sk(w, 22, 999)} />
          ))}
        </div>
        <div className="lst-actions">
          <div className="skeleton" style={sk(104, 40, 10)} />
          <div className="skeleton" style={sk(96, 36)} />
          <div className="skeleton" style={sk(112, 36)} />
          <div className="skeleton" style={sk(84, 36)} />
          <div className="skeleton" style={sk(36, 36)} />
        </div>
      </div>

      <div className="lst-grid" aria-hidden="true">
        <div className="lst-main">
          <div className="lst-secnav">
            <div className="lst-secnav-inner">
              {[56, 72, 52, 66, 62, 40, 92].map((w) => (
                <div
                  key={w}
                  className="skeleton"
                  style={{ ...sk(w, 18), margin: '0.55rem 0.75rem' }}
                />
              ))}
            </div>
          </div>

          <div className="lst-section lst-install">
            <div className="lst-install-head">
              <div>
                <div className="skeleton" style={sk(200, 24)} />
                <div
                  className="skeleton"
                  style={{ ...sk(300, 14), marginTop: '0.55rem' }}
                />
              </div>
            </div>
            <div className="lst-install-body">
              <div
                className="skeleton"
                style={sk('min(100%, 34rem)', 42, 12)}
              />
              <div className="skeleton" style={sk('100%', 38)} />
              <div className="skeleton" style={sk('100%', 220, 12)} />
              <div className="lst-install-footer">
                <div className="skeleton" style={sk(200, 34)} />
                <div className="skeleton" style={sk(120, 34)} />
              </div>
            </div>
          </div>

          <div className="lst-section">
            <div className="skeleton" style={sk(140, 26)} />
            {['100%', '96%', '88%', '70%'].map((w, i) => (
              <div
                key={w}
                className="skeleton"
                style={{
                  ...sk(w, 15),
                  marginTop: i === 0 ? '1.15rem' : '0.7rem',
                }}
              />
            ))}
          </div>
        </div>

        <div className="lst-side">
          <div className="lst-card">
            <div className="skeleton" style={sk(96, 16)} />
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '1rem',
                }}
              >
                <div className="skeleton" style={sk(70, 13)} />
                <div className="skeleton" style={sk(90, 13)} />
              </div>
            ))}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                marginTop: '1.25rem',
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={sk('100%', 58)} />
              ))}
            </div>
          </div>
          <div className="lst-card">
            <div className="skeleton" style={sk(130, 16)} />
            <div
              className="skeleton"
              style={{ ...sk('100%', 13), marginTop: '0.9rem' }}
            />
            <div
              className="skeleton"
              style={{ ...sk('80%', 13), marginTop: '0.55rem' }}
            />
            <div
              className="skeleton"
              style={{ ...sk('100%', 34), marginTop: '1rem' }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
