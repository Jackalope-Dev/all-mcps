import { BadgeCheck, BarChart3, Link2, Mail, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type React from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { AuthSubmitButton } from '@/components/forms/AuthSubmitButton';
import { auth, signIn } from '@/lib/auth';
import { isUserInEU } from '@/lib/consentRegion';
import {
  NEWSLETTER_SUBSCRIBERS_LIST_ID,
  syncSequenzySubscriber,
} from '@/lib/sequenzy';

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
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl: rawCallbackUrl } = await searchParams;
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

  // GDPR/PECR: no pre-ticked opt-in for EU/UK visitors — same signal the
  // cookie banner uses, read here from the real geo header since this is
  // server-rendered (searchParams already forces this route dynamic).
  const reqHeaders = await headers();
  const inEU = isUserInEU(reqHeaders.get('cf-ipcountry') || undefined);

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

        <form
          action={async (formData) => {
            'use server';
            const email = String(formData.get('email') || '');
            const rawRedirect = formData.get('redirectTo');
            const isValidRedirect =
              typeof rawRedirect === 'string' &&
              rawRedirect.startsWith('/') &&
              !rawRedirect.startsWith('//') &&
              !rawRedirect.startsWith('/login') &&
              !rawRedirect.startsWith('/verify-request');
            const redirectTo = isValidRedirect ? rawRedirect : '/dashboard';
            const newsletterOptIn = formData.get('newsletterOptIn') === 'on';
            // Call with redirect: false and redirect to our own /verify-request
            // page ourselves, rather than letting next-auth issue its internal
            // redirect — that one always points at the raw `/api/auth/verify-request`
            // route (basePath + action name) instead of the custom page set in
            // pages.verifyRequest, and a POST reaching that route 500s with
            // "UnknownAction: Cannot handle action: verify-request" since it's
            // GET-only.
            await signIn('resend', {
              email,
              redirect: false,
              redirectTo,
            });
            if (newsletterOptIn && email) {
              await syncSequenzySubscriber({
                email,
                tags: ['newsletter-signup'],
                lists: [NEWSLETTER_SUBSCRIBERS_LIST_ID],
                customAttributes: { source: 'login' },
                enrollInSequences: true,
              });
            }
            redirect('/verify-request');
          }}
          className="acct-auth-form"
        >
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
            <input
              type="checkbox"
              name="newsletterOptIn"
              defaultChecked={!inEU}
            />
            <span>
              Send me the weekly AllMCPs newsletter — new servers and guides.
            </span>
          </label>

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
