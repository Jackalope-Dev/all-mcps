'use client';

import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { PageShell } from '../components/PageShell';
import { EmptyState } from '../components/EmptyState';
import { attemptAutoReload } from '../lib/errorRecovery';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Most errors here are transient post-deploy chunk/asset load failures that a
  // refresh fixes. Recover automatically (one guarded reload per URL) instead of
  // stranding the user on a dead-end error page.
  const [recovering, setRecovering] = useState(true);

  useEffect(() => {
    console.error('Unhandled app error:', error);
    if (attemptAutoReload()) {
      // Reload triggered. Reveal the fallback UI if navigation somehow doesn't
      // happen within a few seconds, so we never strand the user on a blank page.
      const t = setTimeout(() => setRecovering(false), 4000);
      return () => clearTimeout(t);
    }
    setRecovering(false);
  }, [error]);

  // A reload was triggered — render nothing to avoid flashing the error UI.
  if (recovering) return null;

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
