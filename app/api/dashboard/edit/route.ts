import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { servers } from '@/db/schema';
import { auth } from '@/lib/auth';
import { diffEditableFields, serializePendingRevision } from '@/lib/pendingRevision';
import { isSafeSubmissionUrl } from '@/lib/urlSafety';
import { sendNotificationEmail } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';

const editSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: z.string().min(1).max(100),
  websiteUrl: z.string().url().optional().or(z.literal('')),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const parsed = editSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { id, name, description, category } = parsed.data;
    const websiteUrl = (parsed.data.websiteUrl || '').trim();
    if (websiteUrl && !isSafeSubmissionUrl(websiteUrl)) {
      return NextResponse.json({ error: 'Website URL must be a public http(s) address.' }, { status: 400 });
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
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

    const diff = diffEditableFields(
      {
        name: server.name,
        description: server.description,
        category: server.category,
        websiteUrl: server.websiteUrl || '',
      },
      { name, description, category, websiteUrl }
    );

    if (Object.keys(diff).length === 0) {
      return NextResponse.json({ error: 'No changes to submit.' }, { status: 400 });
    }

    await db
      .update(servers)
      .set({ pendingRevision: serializePendingRevision(diff) })
      .where(eq(servers.id, id));

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: 'New pending edit',
        message: `${server.name} has a pending edit awaiting review.`,
        actionText: 'Review in admin',
        actionUrl: `${getAppUrl()}/admin`,
      });
    }

    return NextResponse.json({ success: true, message: 'Edit submitted for review.' });
  } catch (error) {
    console.error('Dashboard edit error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
