import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import { PageShell } from '@/components/PageShell';
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
  const { callbackUrl } = await searchParams;
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
    <PageShell variant="auth" panel>
      <div style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '1.25rem',
          }}
        >
          <BrandLogo size="lg" href={null} showWordmark={false} />
        </div>
        <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
          Sign in to <span className="text-brand-gradient">AllMCPs</span>
        </h1>
        <p className="text-meta" style={{ lineHeight: 1.5 }}>
          Enter your email to receive a secure login link. No password required.
        </p>
      </div>

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
        className="form-stack"
        style={{ textAlign: 'left' }}
      >
        <div className="form-field">
          <label htmlFor="email" className="form-label">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="form-input"
          />
        </div>

        <input type="hidden" name="redirectTo" value={targetRedirect} />

        <label className="form-checkbox-row">
          <input
            type="checkbox"
            name="newsletterOptIn"
            defaultChecked={!inEU}
          />
          <span>
            Keep me posted with the AllMCPs newsletter (new servers, guides,
            product updates).
          </span>
        </label>

        <button
          type="submit"
          className="btn btn-primary btn-full"
          style={{ padding: '0.65rem 1rem', fontSize: '0.95rem' }}
        >
          Send Magic Link →
        </button>
      </form>

      <div
        style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border-color)',
          textAlign: 'left',
        }}
      >
        <h2
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.6rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Developer Dashboard Features
        </h2>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            fontSize: '0.825rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.75,
          }}
        >
          <li>
            ✓ <strong>Claim &amp; Edit Listings</strong> — Update metadata and
            verify ownership.
          </li>
          <li>
            ✓ <strong>LLM Usage Analytics</strong> — Monitor API hits,
            impressions, and caller breakdown.
          </li>
          <li>
            ✓ <strong>Reciprocal Dofollow Backlinks</strong> — Pass ranking
            signals to your product site.
          </li>
          <li>
            ✓ <strong>Spotlight Boosts</strong> — Feature your MCP at the top of
            search and category discovery.
          </li>
        </ul>
      </div>
    </PageShell>
  );
}
