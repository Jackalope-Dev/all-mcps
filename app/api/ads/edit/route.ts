import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sponsorAds } from '@/db/schema';
import {
  AD_EDITABLE_STATUSES,
  diffAdFields,
  type EditableAdFields,
  serializeAdRevision,
  validateAdEdit,
} from '@/lib/adRevision';
import { auth } from '@/lib/auth';
import { getEmailEnv, sendNotificationEmail } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';
import { formatZodError } from '@/lib/zodError';

export const dynamic = 'force-dynamic';

const editSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  ctaText: z.string(),
  targetUrl: z.string(),
});

/**
 * Advertiser proposes new copy/link for one of their campaigns. Stored as a
 * pending revision for admin approval; the live ad (and its impression
 * allocation) is untouched until then. Submitting again replaces the pending
 * edit.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const parsed = editSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 },
      );
    }
    const { id, ...fields } = parsed.data;
    const submitted: EditableAdFields = {
      title: fields.title.trim(),
      description: fields.description.trim(),
      ctaText: fields.ctaText.trim(),
      targetUrl: fields.targetUrl.trim(),
    };
    const invalid = validateAdEdit(submitted);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    const { env } = await getCloudflareContext();
    if (!env?.DB) {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 500 },
      );
    }
    const db = drizzle(env.DB);
    const [ad] = await db
      .select()
      .from(sponsorAds)
      .where(eq(sponsorAds.id, id))
      .limit(1);
    if (!ad) {
      return NextResponse.json(
        { error: 'Campaign not found.' },
        { status: 404 },
      );
    }

    // Same ownership rule as the dashboard's campaign list (getOwnedAds):
    // created while signed in, or under this account's email.
    const sessionEmail = session.user?.email?.trim().toLowerCase();
    const owns =
      ad.advertiserUserId === userId ||
      (!!sessionEmail &&
        ad.advertiserEmail.trim().toLowerCase() === sessionEmail);
    if (!owns) {
      return NextResponse.json(
        { error: 'You do not own this campaign.' },
        { status: 403 },
      );
    }
    if (!AD_EDITABLE_STATUSES.has(ad.status)) {
      return NextResponse.json(
        { error: 'Finished or rejected campaigns can no longer be edited.' },
        { status: 409 },
      );
    }

    const diff = diffAdFields(
      {
        title: ad.title,
        description: ad.description,
        ctaText: ad.ctaText,
        targetUrl: ad.targetUrl,
      },
      submitted,
    );
    if (Object.keys(diff).length === 0) {
      return NextResponse.json(
        { error: 'No changes to submit.' },
        { status: 400 },
      );
    }

    await db
      .update(sponsorAds)
      .set({ pendingRevision: serializeAdRevision(diff) })
      .where(eq(sponsorAds.id, id));

    const { adminEmail } = await getEmailEnv();
    if (adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: 'Ad edit awaiting review',
        message: `"${ad.title}" (${ad.advertiserEmail}) proposed changes to: ${Object.keys(diff).join(', ')}. The current version keeps serving until you approve.`,
        actionText: 'Review in admin',
        actionUrl: `${getAppUrl()}/admin`,
      });
    }

    return NextResponse.json({
      success: true,
      message:
        'Edit submitted for review. Your ad keeps running as-is until it is approved.',
      proposed: diff,
    });
  } catch (error) {
    console.error('[ads/edit] error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
