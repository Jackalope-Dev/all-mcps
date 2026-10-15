import { Lock } from 'lucide-react';

/**
 * "Please sign in" placeholder shown in place of a login-gated form. Extracted
 * from app/mcp/[id]/claim/ClaimClient.tsx (originally a private, non-exported
 * function used in 3 places there) so other login-gated UI on the listing
 * page — e.g. the review composer — can reuse the same look instead of
 * re-inventing it.
 */
export function SignInGate({
  href,
  message = 'Sign in to generate your account-linked verification token.',
}: {
  href: string;
  message?: string;
}) {
  return (
    <div className="acct-gate">
      <span className="acct-gate-icon" aria-hidden="true">
        <Lock size={18} />
      </span>
      <p>{message}</p>
      <a href={href} className="btn btn-primary btn-md">
        Sign in to continue
      </a>
    </div>
  );
}
