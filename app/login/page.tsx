import { BadgeCheck, BarChart3, Link2, Mail, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type React from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { AuthSubmitButton } from '@/components/forms/AuthSubmitButton';
import { TurnstileWidget } from '@/components/ui/TurnstileWidget';
import { auth } from '@/lib/auth';
import { requestSignInLink } from './actions';

export const metadata: Metadata = {
  title: 'Sign In to Manage Your MCP Server Listings',
  description:
    'Sign in with a secure magic link to manage, claim, and update your MCP server listings on AllMCPs — no password required.',
  robots: {
    index: false,
    follow: true,
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const { callbackUrl: rawCallbackUrl, error } = await searchParams;
  // Drop any URL fragment: it's never sent to the server anyway, and an encoded
  // "%23" surviving into the magic-link callback query is mis-parsed by the
  // Cloudflare adapter — it truncates the query at that point, dropping the
  // verification token and every param after it (Auth.js then throws
  // "Configuration: Missing token").
  const callbackUrl =
    typeof rawCallbackUrl === 'string'
      ? rawCallbackUrl.split('#')[0]
      : rawCallbackUrl;
  // Must be a same-app relative path: reject absolute/protocol-relative URLs
  // (e.g. "//evil.com" starts with "/" but browsers treat it as external),
  // and avoid loops to login/verify-request.
  const isValidRedirect =
    typeof callbackUrl === 'string' &&
    callbackUrl.startsWith('/') &&
    !callbackUrl.startsWith('//') &&
    !callbackUrl.startsWith('/login') &&
    !callbackUrl.startsWith('/verify-request');

  const defaultDestination =
    (session?.user as any)?.role === 'admin' ? '/admin' : '/dashboard';
  const targetRedirect = isValidRedirect ? callbackUrl : defaultDestination;

  if (session?.user) {
    redirect(targetRedirect);
  }

  return (
    <main className="acct-auth">
      <div className="acct-auth-card animate-in">
        <div className="acct-auth-mark">
          <BrandLogo size="lg" href={null} showWordmark={false} />
        </div>
        <h1 className="acct-auth-title">Sign in to AllMCPs</h1>
        <p className="acct-auth-sub">
          We&rsquo;ll email you a secure one-time link. No password needed.
        </p>
        {error === 'email' && (
          <p className="acct-auth-sub" role="alert">
            We can&rsquo;t send a sign-in link to that address. Use an email you
            can receive mail at, or contact support@allmcps.com.
          </p>
        )}
        {error === 'check' && (
          <p className="acct-auth-sub" role="alert">
            The security check didn&rsquo;t finish. Wait for it to complete,
            then send the link again.
          </p>
        )}

        <form action={requestSignInLink} className="acct-auth-form">
          <div className="form-field">
            <label htmlFor="email" className="form-label">
              Work or personal email
            </label>
            <div className="acct-input-icon">
              <Mail size={16} aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                className="form-input"
              />
            </div>
          </div>

          <input type="hidden" name="redirectTo" value={targetRedirect} />

          <label className="form-checkbox-row">
            <input type="checkbox" name="newsletterOptIn" />
            <span>
              Send me the weekly AllMCPs newsletter: new servers and guides.
              We&rsquo;ll ask you to confirm first.
            </span>
          </label>

          <TurnstileWidget />

          <AuthSubmitButton />
        </form>

        <p className="acct-auth-fine">
          By continuing you agree to the <Link href="/terms">Terms</Link> and{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>

      <section
        className="acct-auth-perks animate-in"
        style={{ '--i': 2 } as React.CSSProperties}
      >
        <h2 className="acct-auth-perks-title">With an account you can</h2>
        <ul>
          <li>
            <BadgeCheck size={16} aria-hidden="true" />
            <span>
              <strong>Claim &amp; edit listings</strong> and verify ownership
            </span>
          </li>
          <li>
            <BarChart3 size={16} aria-hidden="true" />
            <span>
              <strong>See usage analytics</strong> — views and installs, plus AI
              callers on Premium or boosted listings
            </span>
          </li>
          <li>
            <Link2 size={16} aria-hidden="true" />
            <span>
              <strong>Earn a dofollow backlink</strong> to your product site
            </span>
          </li>
          <li>
            <Sparkles size={16} aria-hidden="true" />
            <span>
              <strong>Boost visibility</strong> in search and categories
            </span>
          </li>
        </ul>
      </section>
    </main>
  );
}
