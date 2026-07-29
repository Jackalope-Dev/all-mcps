import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { z } from 'zod';
import { type PaidSku } from '../../../../lib/pricing';
import { createStripeCheckoutSession } from '../../../../lib/stripeCheckout';

const bodySchema = z.object({
  serverId: z.string().min(1),
  sku: z.enum(['priority_review', 'featured_7d', 'premium_monthly']),
  email: z.string().email().optional(),
  coupon: z.string().optional(),
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

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request payload', details: parsed.error.issues }, { status: 400 });
    }

    const { serverId, sku, email, coupon } = parsed.data;

    const result = await createStripeCheckoutSession({
      serverId,
      sku: sku as PaidSku,
      email,
      coupon,
      env,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, hint: result.hint },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({ url: result.url, sessionId: result.sessionId });
  } catch (e: any) {
    console.error('Stripe checkout error:', e);
    return NextResponse.json(
      {
        error: 'Checkout failed',
        details: e?.message || 'Unknown Stripe API error',
      },
      { status: 500 }
    );
  }
}
