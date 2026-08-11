import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { syncSequenzySubscriber, NEWSLETTER_SUBSCRIBERS_LIST_ID } from '../../../lib/sequenzy';

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
      return NextResponse.json({ success: false, error: 'Missing Turnstile token' }, { status: 400 });
    }

    const turnstileSecret = env?.TURNSTILE_SECRET || process.env.TURNSTILE_SECRET || '';
    const verifyForm = new URLSearchParams();
    verifyForm.append('secret', turnstileSecret);
    verifyForm.append('response', token);
    verifyForm.append('remoteip', req.headers.get('x-forwarded-for') || '');

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verifyForm,
    });

    const verifyResult = (await verifyRes.json()) as any;
    if (!verifyResult.success) {
      return NextResponse.json({ success: false, error: 'Turnstile verification failed' }, { status: 403 });
    }

    // 2. Send email via Resend
    const apiKey = env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
    const resend = new Resend(apiKey);

    const fromEmail = env?.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const toEmail = env?.RESEND_TO_EMAIL || process.env.RESEND_TO_EMAIL || env?.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'contact@allmcps.com';

    const data = await resend.emails.send({
      from: `Contact Form <${fromEmail}>`,
      to: [toEmail],
      subject: `New Contact Form Submission from ${body.name}`,
      replyTo: body.email,
      text: `Name: ${body.name}\nEmail: ${body.email}\n\nMessage:\n${body.message}`,
    });

    if (data.error) {
      console.error('Resend API error:', data.error);
      return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 });
    }

    if (body.newsletterOptIn !== false && typeof body.email === 'string' && body.email) {
      await syncSequenzySubscriber({
        email: body.email,
        tags: ['newsletter-signup'],
        lists: [NEWSLETTER_SUBSCRIBERS_LIST_ID],
        customAttributes: { source: 'contact' },
        enrollInSequences: true,
      });
    }

    return NextResponse.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
