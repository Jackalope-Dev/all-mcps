/**
 * Shown immediately on navigation to /mcp/[id] while the real page streams in —
 * this is what was missing before (no loading.tsx anywhere in the app meant
 * clicking a listing link gave zero feedback for however long the page took).
 * Loosely mirrors the real detail-grid layout so the swap-in doesn't jump around.
 */
export default function Loading() {
  return (
    <main className="container page-shell" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)' }}>
      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-title-row">
            <div className="skeleton-block" style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-block" style={{ width: '55%', height: 28, marginBottom: '0.6rem' }} />
              <div className="skeleton-block" style={{ width: '30%', height: 18 }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', margin: '1.25rem 0' }}>
            <div className="skeleton-block" style={{ width: 150, height: 38, borderRadius: 8 }} />
            <div className="skeleton-block" style={{ width: 130, height: 38, borderRadius: 8 }} />
            <div className="skeleton-block" style={{ width: 100, height: 38, borderRadius: 8 }} />
          </div>

          <div className="skeleton-block" style={{ width: '90%', height: 16, marginBottom: '0.5rem' }} />
          <div className="skeleton-block" style={{ width: '70%', height: 16, marginBottom: '1.5rem' }} />

          <div className="skeleton-block" style={{ height: 220, borderRadius: 16, marginBottom: '1.75rem' }} />
          <div className="skeleton-block" style={{ height: 140, borderRadius: 12, marginBottom: '1.5rem' }} />
          <div className="skeleton-block" style={{ height: 280, borderRadius: 12 }} />
        </div>

        <div className="detail-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="skeleton-block" style={{ height: 220, borderRadius: 14 }} />
          <div className="skeleton-block" style={{ height: 160, borderRadius: 14 }} />
          <div className="skeleton-block" style={{ height: 160, borderRadius: 14 }} />
        </div>
      </div>
    </main>
  );
}
