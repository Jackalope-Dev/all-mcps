'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StatusScreen } from '../components/StatusScreen';
import { Button } from '../components/ui/Button';
import {
  attemptAutoReload,
  isLikelyTransientLoadError,
} from '../lib/errorRecovery';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Most errors here are transient post-deploy chunk/asset load failures that a
  // refresh fixes. Recover automatically (one guarded reload per URL) only when
  // the error actually matches a network/chunk failure.
  const [recovering, setRecovering] = useState(() =>
    isLikelyTransientLoadError(error),
  );

  useEffect(() => {
    console.error('Unhandled app error:', error);
    if (isLikelyTransientLoadError(error) && attemptAutoReload()) {
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
    <StatusScreen
      code="Error"
      title="Something went wrong"
      description="An unexpected error interrupted this page. Trying again usually fixes it — if it keeps happening, let us know."
      showSearch={false}
      actions={
        <>
          <Button onClick={() => reset()} variant="primary">
            <RotateCcw size={15} aria-hidden="true" />
            Try again
          </Button>
          <Button href="/contact" variant="secondary">
            Report a problem
          </Button>
        </>
      }
    />
  );
}
