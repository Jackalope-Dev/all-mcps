/** Instant navigation feedback for /clients/[client] — see app/mcp/[id]/loading.tsx for why this exists. */
export default function Loading() {
  return (
    <main className="container page-shell" style={{ paddingBottom: '4rem' }}>
      <div
        className="skeleton-block"
        style={{ width: '55%', height: 32, marginBottom: '0.75rem' }}
      />
      <div
        className="skeleton-block"
        style={{ width: '80%', height: 18, marginBottom: '2rem' }}
      />
      <div
        className="skeleton-block"
        style={{ height: 220, borderRadius: 16, marginBottom: '2rem' }}
      />
      <div style={{ display: 'grid', gap: '1rem' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-block"
            style={{ height: 90, borderRadius: 14 }}
          />
        ))}
      </div>
    </main>
  );
}
