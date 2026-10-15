export default function StackLoading() {
  return (
    <main
      className="tl-page"
      aria-busy="true"
      aria-label="Loading stack builder"
    >
      <div className="tl-container">
        <div
          className="skeleton"
          style={{ width: '12rem', height: '0.9rem', marginBottom: '1.25rem' }}
        />
        <div
          className="skeleton"
          style={{
            width: 'min(28rem, 80%)',
            height: '2.25rem',
            marginBottom: '0.75rem',
          }}
        />
        <div
          className="skeleton"
          style={{
            width: 'min(36rem, 95%)',
            height: '1rem',
            marginBottom: '2rem',
          }}
        />
        <div className="tl-workspace">
          <div className="tl-pane">
            <div
              className="skeleton"
              style={{ height: '1.4rem', width: '9rem' }}
            />
            <div className="skeleton" style={{ height: '2.75rem' }} />
            <div className="skeleton" style={{ height: '3.25rem' }} />
            <div className="skeleton" style={{ height: '3.25rem' }} />
          </div>
          <div className="tl-pane">
            <div
              className="skeleton"
              style={{ height: '1.4rem', width: '7rem' }}
            />
            <div
              className="skeleton"
              style={{ height: '2.25rem', width: '20rem', maxWidth: '100%' }}
            />
            <div className="skeleton" style={{ height: '16rem' }} />
          </div>
        </div>
      </div>
    </main>
  );
}
