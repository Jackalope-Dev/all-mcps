import { Mail } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'Check your email',
  description: 'A sign-in link has been sent to your email address.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function VerifyRequestPage() {
  return (
    <PageShell variant="auth" panel>
      <div
        className="empty-state-icon"
        style={{ margin: '0 auto 1.5rem', width: '4rem', height: '4rem', borderRadius: '50%' }}
      >
        <Mail size={28} aria-hidden="true" />
      </div>

      <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
        Check your email
      </h1>
      <p className="text-meta" style={{ marginBottom: '2rem', lineHeight: 1.6 }}>
        A sign in link has been sent to your email address. Click the link in the email to sign in.
      </p>

      <Link href="/" className="nav-link" style={{ fontSize: '0.875rem' }}>
        &larr; Back to home
      </Link>
    </PageShell>
  );
}
