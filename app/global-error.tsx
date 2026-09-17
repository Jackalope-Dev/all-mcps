'use client';

import { useEffect, useState } from 'react';
import {
  attemptAutoReload,
  isLikelyTransientLoadError,
} from '../lib/errorRecovery';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Recover automatically from transient post-deploy load failures (one guarded
  // reload per URL) only when the error matches a network/chunk failure.
  const [recovering, setRecovering] = useState(() =>
    isLikelyTransientLoadError(error),
  );

  useEffect(() => {
    console.error('Unhandled root layout error:', error);
    if (isLikelyTransientLoadError(error) && attemptAutoReload()) {
      const t = setTimeout(() => setRecovering(false), 4000);
      return () => clearTimeout(t);
    }
    setRecovering(false);
  }, [error]);

  if (recovering) {
    // A reload was triggered (or is being decided) — render a minimal shell so
    // the "Something went wrong" screen never flashes before navigation.
    return (
      <html lang="en">
        <body style={{ margin: 0, background: '#020617' }} />
      </html>
    );
  }

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#020617',
          color: '#ffffff',
          fontFamily:
            '"Atkinson Hyperlegible Next", system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '4rem 2rem',
            borderRadius: '24px',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <h1
            style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 700 }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              color: '#94a3b8',
              marginBottom: '2.5rem',
              lineHeight: '1.6',
            }}
          >
            AllMCPs hit an unexpected error. Please try reloading the page.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => reset()}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #00E5FF, #007BFF)',
                color: '#020617',
              }}
            >
              Try Again
            </button>
            <a
              href="/"
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 600,
                textDecoration: 'none',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
