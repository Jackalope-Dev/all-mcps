import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  NEWSLETTER_SUBSCRIBERS_LIST_ID,
  syncSequenzySubscriber,
} from '../../../../lib/sequenzy';

const subscribeSchema = z.object({
  email: z.string().email(),
  source: z.enum(['footer', 'homepage', 'modal']),
});

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

    if (!token) {
      return NextResponse.json(
        { error: 'Missing Turnstile token' },
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
        { error: 'Verification failed' },
        { status: 403 },
      );
    }

    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { email, source } = parsed.data;

    await syncSequenzySubscriber({
      email,
      tags: ['newsletter-signup'],
      lists: [NEWSLETTER_SUBSCRIBERS_LIST_ID],
      customAttributes: { source },
      enrollInSequences: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Newsletter subscribe error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
