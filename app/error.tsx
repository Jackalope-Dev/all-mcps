'use client';

import { useEffect } from 'react';
import { Button } from '../components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <main className="container" style={{ padding: '8rem 1rem', textAlign: 'center' }}>
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '4rem 2rem', borderRadius: '24px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: '1.6' }}>
          An unexpected error occurred. Please try reloading the page or return to the main directory.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button onClick={() => reset()} variant="primary">
            Try Again
          </Button>
          <Button href="/" variant="secondary">
            Go Home
          </Button>
        </div>
      </div>
    </main>
  );
}
