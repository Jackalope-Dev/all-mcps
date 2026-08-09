/** Instant navigation feedback for /categories/[slug] — see app/mcp/[id]/loading.tsx for why this exists. */
export default function Loading() {
  return (
    <main className="container page-shell" style={{ paddingBottom: '4rem' }}>
      <div className="skeleton-block" style={{ width: '50%', height: 32, marginBottom: '0.75rem' }} />
      <div className="skeleton-block" style={{ width: '75%', height: 18, marginBottom: '2rem' }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
          gap: '1rem',
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 168, borderRadius: 14 }} />
        ))}
      </div>
    </main>
  );
}
