import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { servers } from '@/db/schema';
import { auth } from '@/lib/auth';
import { processLogoUpload, LogoValidationError } from '@/lib/logoImage';
import { sendNotificationEmail, getEmailEnv } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';

const ID_PATTERN = /^[a-z0-9-]+$/;

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const form = await req.formData();
    const id = String(form.get('id') || '');
    const file = form.get('logo');

    if (!id || !ID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Invalid listing id.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No logo file provided.' }, { status: 400 });
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      return NextResponse.json({ error: 'Storage unavailable' }, { status: 500 });
    }
    if (!env?.DB || !env?.LOGOS) {
      return NextResponse.json({ error: 'Storage unavailable' }, { status: 500 });
    }

    const db = drizzle(env.DB as any);
    const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    const server = rows[0];
    if (!server) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    if (server.ownerUserId !== userId) {
      return NextResponse.json({ error: 'You do not own this listing.' }, { status: 403 });
    }

    let processed: Buffer;
    try {
      processed = await processLogoUpload(await file.arrayBuffer());
    } catch (err) {
      if (err instanceof LogoValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const pendingKey = `pending/${id}.png`;
    await env.LOGOS.put(pendingKey, processed, { httpMetadata: { contentType: 'image/png' } });
    await db.update(servers).set({ pendingLogoKey: pendingKey }).where(eq(servers.id, id));

    const emailEnv = await getEmailEnv();
    if (emailEnv.adminEmail) {
      await sendNotificationEmail({
        to: emailEnv.adminEmail,
        heading: 'New pending logo',
        message: `${server.name} has a logo awaiting review.`,
        actionText: 'Review in admin',
        actionUrl: `${getAppUrl()}/admin`,
      });
    }

    return NextResponse.json({ success: true, message: 'Logo submitted for review.' });
  } catch (error) {
    console.error('Dashboard logo upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
