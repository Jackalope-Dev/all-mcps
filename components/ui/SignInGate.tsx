import { Lock } from 'lucide-react';
import { SignInLink } from './SignInLink';

/**
 * "Please sign in" placeholder shown in place of a login-gated form. Extracted
 * from app/mcp/[id]/claim/ClaimClient.tsx (originally a private, non-exported
 * function used in 3 places there) so other login-gated UI on the listing
 * page — e.g. the review composer — can reuse the same look instead of
 * re-inventing it.
 */
export function SignInGate({
  callbackUrl,
  message = 'Sign in to generate your account-linked verification token.',
}: {
  /** Page to return to after signing in. */
  callbackUrl: string;
  message?: string;
}) {
  return (
    <div className="acct-gate">
      <span className="acct-gate-icon" aria-hidden="true">
        <Lock size={18} />
      </span>
      <p>{message}</p>
      <SignInLink callbackUrl={callbackUrl} className="btn btn-primary btn-md">
        Sign in to continue
      </SignInLink>
    </div>
  );
}
