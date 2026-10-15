/** Instant navigation feedback for /clients/[client] — see app/mcp/[id]/loading.tsx for why this exists. */
export default function Loading() {
  return (
    <main className="page-shell content-page cl-page" aria-busy="true">
      <div className="page-shell-inner">
        <div className="content-hub-head">
          <div className="skeleton cl-sk-line" style={{ width: '9rem' }} />
          <div className="skeleton cl-sk-title" />
          <div className="skeleton cl-sk-line" style={{ width: '80%' }} />
          <div className="skeleton cl-sk-line" style={{ width: '60%' }} />
        </div>
        <div className="cl-setup">
          <div className="cl-steps">
            {['a', 'b', 'c', 'd'].map((k) => (
              <div key={k} className="skeleton cl-sk-step" />
            ))}
          </div>
          <div className="skeleton cl-sk-config" />
        </div>
      </div>
    </main>
  );
}
