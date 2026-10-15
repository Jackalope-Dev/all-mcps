'use client';

import { ArrowRight, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

/** Submit button for the server-action magic-link form: shows a pending state
 *  so a slow email send never looks like a dead click. */
export function AuthSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn btn-primary btn-lg btn-full acct-auth-submit"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Loader2 size={16} className="acct-spin" aria-hidden="true" />
          Sending link…
        </>
      ) : (
        <>
          Email me a sign-in link
          <ArrowRight size={16} aria-hidden="true" />
        </>
      )}
    </button>
  );
}
