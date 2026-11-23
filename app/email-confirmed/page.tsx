import { ArrowLeft, MailCheck, MailX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Email confirmation',
  description: 'Confirm the email address you submitted a listing with.',
  robots: {
    index: false,
    follow: true,
  },
};

/** Where app/api/email/confirm sends the submitter after the link is used. */
export default async function EmailConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; listing?: string }>;
}) {
  const { status, listing } = await searchParams;
  const ok = status === 'ok';
  const listingId =
    typeof listing === 'string' && /^[a-z0-9][a-z0-9._-]*$/i.test(listing)
      ? listing
      : null;
  const claimHref = listingId
    ? `/login?callbackUrl=${encodeURIComponent(`/mcp/${listingId}/claim`)}`
    : '/login';

  return (
    <main className="acct-auth">
      <div className="acct-auth-card animate-in">
        <div className="acct-verify-icon" aria-hidden="true">
          {ok ? <MailCheck size={26} /> : <MailX size={26} />}
        </div>
        <h1 className="acct-auth-title">
          {ok ? 'Email confirmed' : 'This link has expired'}
        </h1>
        <p className="acct-auth-sub">
          {ok
            ? 'Thanks. We will email you when your listing is reviewed. To claim and edit it now, sign in with the same address.'
            : 'Confirmation links work for 7 days. Sign in with the address you submitted with and it is confirmed at the same time.'}
        </p>
        <div className="acct-verify-actions">
          <Link href={claimHref} className="btn btn-primary btn-md">
            {ok && listingId ? 'Sign in to claim it' : 'Sign in'}
          </Link>
          {listingId ? (
            <Link
              href={`/mcp/${listingId}`}
              className="btn btn-secondary btn-md"
            >
              View listing
            </Link>
          ) : null}
        </div>
      </div>

      <Link href="/" className="acct-auth-back">
        <ArrowLeft size={14} aria-hidden="true" />
        Back to AllMCPs
      </Link>
    </main>
  );
}
