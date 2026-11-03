import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getEmailEnv, sendNotificationEmail } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';
import { resubmitSubmission } from '@/lib/submissions';

/**
 * A submitter edits their rejected submission and sends it back for review
 * (lib/submissions.ts). Signed-in only, and only for submissions made with
 * the signed-in email.
 */
const schema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().max(200),
  description: z.string().max(2000),
  url: z.string().max(2000),
  websiteUrl: z.string().max(2000).optional(),
  remoteEndpointUrl: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user?.id || !email) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  try {
    const { env } = await getCloudflareContext();
    const db = drizzle((env as any).DB);
    const { id, ...fields } = parsed.data;
    const result = await resubmitSubmission(db, email, id, fields);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    const { adminEmail } = await getEmailEnv();
    if (adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: `Resubmitted: ${result.name}`,
        message: `"${result.name}" (${result.url}) was edited and resubmitted by ${email} after a rejection.`,
        actionText: 'Review in Admin Panel',
        actionUrl: `${getAppUrl()}/admin`,
      }).catch((e) => console.error('resubmit admin alert failed:', e));
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('resubmit error:', e);
    return NextResponse.json(
      { error: 'Could not resubmit. Please try again.' },
      { status: 500 },
    );
  }
}
