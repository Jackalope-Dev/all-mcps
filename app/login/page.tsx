import { signIn } from '@/lib/auth';
import { BrandLogo } from '@/components/BrandLogo';
import { PageShell } from '@/components/PageShell';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  // Must be a same-app relative path: reject absolute/protocol-relative URLs
  // (e.g. "//evil.com" starts with "/" but browsers treat it as external).
  const redirectTo =
    callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : undefined;

  return (
    <PageShell variant="auth" panel>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
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
          await signIn('resend', formData);
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

        {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

        <button type="submit" className="btn btn-primary btn-full">
          Send Magic Link
        </button>
      </form>
    </PageShell>
  );
}
