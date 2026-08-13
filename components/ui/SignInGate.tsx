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
    <div
      style={{
        padding: '1.75rem',
        textAlign: 'center',
        border: '1px dashed var(--border-color)',
        borderRadius: '12px',
        background: 'var(--bg-muted)',
      }}
    >
      <Lock size={28} color="var(--accent-color)" style={{ marginBottom: '0.5rem' }} />
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>{message}</p>
      <a href={href} className="btn btn-primary" style={{ textDecoration: 'none', padding: '0.6rem 1.25rem' }}>
        Sign In to Continue
      </a>
    </div>
  );
}
