import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { servers } from '../../../../db/schema';
import { getAppUrl, getStripe } from '../../../../lib/stripe';

const bodySchema = z.object({
  serverId: z.string().min(1),
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

    const secretKey = env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (!env?.DB) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    const db = drizzle(env.DB);
    const rows = await db.select().from(servers).where(eq(servers.id, parsed.data.serverId)).limit(1);
    const server = rows[0];
    if (!server?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing customer on this listing. Complete a Premium checkout first.' },
        { status: 400 }
      );
    }

    const stripe = getStripe(secretKey);
    const session = await stripe.billingPortal.sessions.create({
      customer: server.stripeCustomerId,
      return_url: `${getAppUrl()}/mcp/${encodeURIComponent(server.id)}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('Stripe portal error:', e);
    return NextResponse.json({ error: 'Could not open billing portal' }, { status: 500 });
  }
}
