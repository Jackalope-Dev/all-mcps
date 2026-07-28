'use client';

import { useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { PageShell } from '../components/PageShell';
import { EmptyState } from '../components/EmptyState';

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
    <PageShell variant="status" panel className="animate-fade-in">
      <EmptyState
        title="Something went wrong"
        description="An unexpected error occurred. Please try reloading the page or return to the main directory."
        actions={
          <>
            <Button onClick={() => reset()} variant="primary">
              Try Again
            </Button>
            <Button href="/" variant="secondary">
              Go Home
            </Button>
          </>
        }
      />
    </PageShell>
  );
}
