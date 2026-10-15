import { ArrowLeft, Clock, Inbox, MailCheck, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Check your email',
  description: 'A sign-in link has been sent to your email address.',
  robots: {
    index: false,
    follow: true,
  },
};

export default async function VerifyRequestPage() {
  const session = await auth();
  if (session?.user) {
    if ((session.user as any).role === 'admin') {
      redirect('/admin');
    }
    redirect('/dashboard');
  }

  return (
    <main className="acct-auth">
      <div className="acct-auth-card animate-in">
        <div className="acct-verify-icon" aria-hidden="true">
          <MailCheck size={26} />
        </div>
        <h1 className="acct-auth-title">Check your inbox</h1>
        <p className="acct-auth-sub">
          We sent you a sign-in link. Open the email from AllMCPs and click the
          button to finish signing in.
        </p>

        <ul className="acct-verify-tips">
          <li>
            <Clock size={15} aria-hidden="true" />
            <span>The link works once and expires in 24 hours.</span>
          </li>
          <li>
            <Inbox size={15} aria-hidden="true" />
            <span>
              Nothing after a minute? Check spam or the Promotions tab.
            </span>
          </li>
          <li>
            <ShieldCheck size={15} aria-hidden="true" />
            <span>
              You can close this tab — the link signs you in anywhere.
            </span>
          </li>
        </ul>

        <div className="acct-verify-actions">
          <a
            href="https://mail.google.com/mail/u/0/#search/from%3Aallmcps"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-md"
          >
            Open Gmail
          </a>
          <a
            href="https://outlook.live.com/mail/0/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-md"
          >
            Open Outlook
          </a>
        </div>

        <p className="acct-auth-fine">
          Wrong address? <Link href="/login">Use a different email</Link>
        </p>
      </div>

      <Link href="/" className="acct-auth-back">
        <ArrowLeft size={14} aria-hidden="true" />
        Back to AllMCPs
      </Link>
    </main>
  );
}
