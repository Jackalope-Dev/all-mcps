'use server';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth';
import {
  NEWSLETTER_SUBSCRIBERS_LIST_ID,
  syncSequenzySubscriber,
} from '@/lib/sequenzy';
import { hashSubmitterIp, screenSubmitter } from '@/lib/submitterBlocks';
import { verifyTurnstileToken } from '@/lib/turnstile';

/**
 * The /login form: the only way to request a magic link (app/api/auth
 * refuses direct POSTs to /api/auth/signin).
 */
export async function requestSignInLink(formData: FormData): Promise<void> {
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
  // Errors come back to this page with the destination kept, so a
  // claim or admin sign-in still lands where it started.
  const retry = (code: 'email' | 'check') =>
    redirect(
      `/login?error=${code}&callbackUrl=${encodeURIComponent(redirectTo)}`,
    );
  const { env } = await getCloudflareContext();
  const actionHeaders = await headers();
  const ip = actionHeaders.get('cf-connecting-ip');
  // Turnstile first, as on /submit and /contact: a script can't
  // make us email an address it typed. This form (a server action)
  // is the only way to request a link: app/api/auth refuses
  // direct POSTs to /api/auth/signin.
  const check = await verifyTurnstileToken(
    formData.get('cf-turnstile-response'),
    env as { TURNSTILE_SECRET?: string },
    ip || '',
  );
  if (!check.ok) retry('check');
  // Same gate as /submit: too many requests from this connection,
  // a blocked email/domain/IP, or an address that can't receive
  // mail gets no link (and no newsletter sync). lib/auth.ts's
  // signIn callback repeats the address checks.
  const problem = await screenSubmitter(
    drizzle(env.DB),
    { email, ipHash: await hashSubmitterIp(ip) },
    env,
  );
  if (problem) retry('email');
  // Call with redirect: false and redirect to our own /verify-request
  // page ourselves, rather than letting next-auth issue its internal
  // redirect: that one always points at the raw `/api/auth/verify-request`
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
    // The sign-in link hasn't been clicked yet, so the address is
    // unproven: Sequenzy asks for confirmation before any issue.
    await syncSequenzySubscriber({
      email,
      tags: ['newsletter-signup'],
      lists: [NEWSLETTER_SUBSCRIBERS_LIST_ID],
      customAttributes: { source: 'login' },
      enrollInSequences: true,
      optInMode: 'double_opt_in',
    });
  }
  redirect('/verify-request');
}
