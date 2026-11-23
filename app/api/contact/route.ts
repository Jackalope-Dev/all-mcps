import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import {
  NEWSLETTER_SUBSCRIBERS_LIST_ID,
  syncSequenzySubscriber,
} from '../../../lib/sequenzy';
import {
  hashSubmitterIp,
  requestIp,
  screenSubmitter,
} from '../../../lib/submitterBlocks';

export async function POST(req: Request) {
  try {
    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      /* fallback */
    }

    const body = (await req.json()) as any;
    const token = body['cf-turnstile-response'];

    // 1. Validate Turnstile token
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing Turnstile token' },
        { status: 400 },
      );
    }

    const turnstileSecret =
      env?.TURNSTILE_SECRET || process.env.TURNSTILE_SECRET || '';
    const verifyForm = new URLSearchParams();
    verifyForm.append('secret', turnstileSecret);
    verifyForm.append('response', token);
    verifyForm.append('remoteip', req.headers.get('x-forwarded-for') || '');

    const verifyRes = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: verifyForm,
      },
    );

    const verifyResult = (await verifyRes.json()) as any;
    if (!verifyResult.success) {
      return NextResponse.json(
        { success: false, error: 'Turnstile verification failed' },
        { status: 403 },
      );
    }

    // 2. Send email via Resend
    const apiKey = env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
    const resend = new Resend(apiKey);

    const fromEmail =
      env?.RESEND_FROM_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      'onboarding@resend.dev';
    const toEmail =
      env?.RESEND_TO_EMAIL ||
      process.env.RESEND_TO_EMAIL ||
      env?.ADMIN_EMAIL ||
      process.env.ADMIN_EMAIL ||
      'contact@allmcps.com';

    const data = await resend.emails.send({
      from: `Contact Form <${fromEmail}>`,
      to: [toEmail],
      subject: `New Contact Form Submission from ${body.name}`,
      replyTo: body.email,
      text: `Name: ${body.name}\nEmail: ${body.email}\n\nMessage:\n${body.message}`,
    });

    if (data.error) {
      console.error('Resend API error:', data.error);
      return NextResponse.json(
        { success: false, error: 'Failed to send email' },
        { status: 500 },
      );
    }

    // The newsletter is opt-in: only an explicit tick counts. The address is
    // whatever was typed, so it is screened like any intake and Sequenzy
    // emails a confirmation link before any issue or sequence goes out. The
    // message itself already reached us either way.
    let newsletter: 'confirm' | 'skipped' | undefined;
    if (
      body.newsletterOptIn === true &&
      typeof body.email === 'string' &&
      body.email
    ) {
      const problem = env?.DB
        ? await screenSubmitter(
            drizzle(env.DB),
            {
              email: body.email,
              ipHash: await hashSubmitterIp(requestIp(req)),
            },
            env,
          )
        : 'Database unavailable';
      if (problem) {
        newsletter = 'skipped';
      } else {
        await syncSequenzySubscriber({
          email: body.email,
          tags: ['newsletter-signup'],
          lists: [NEWSLETTER_SUBSCRIBERS_LIST_ID],
          customAttributes: { source: 'contact' },
          enrollInSequences: true,
          optInMode: 'double_opt_in',
        });
        newsletter = 'confirm';
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully',
      ...(newsletter ? { newsletter } : {}),
    });
  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
